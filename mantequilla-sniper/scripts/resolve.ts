// Resuelve un intento enviado sin confirmación verificable (estado UNCERTAIN/SUBMITTED).
// Uso:
//   npm run resolve -- <attemptId> confirmed <localizador>   (llegó correo/confirmación oficial)
//   npm run resolve -- <attemptId> not-booked                 (CoverManager no registró la reserva)
import { join } from 'node:path';
import { loadCampaign } from '../src/core/config.js';
import { MemoryStore } from '../src/store/memory.js';
import { storeFromEnv } from '../src/store/supabase.js';

const [attemptId, verdict, confirmationId] = process.argv.slice(2);
if (!attemptId || !['confirmed', 'not-booked'].includes(verdict ?? '')) {
  console.error('Uso: resolve <attemptId> confirmed <localizador> | resolve <attemptId> not-booked');
  process.exit(1);
}
const c = loadCampaign(process.env.CAMPAIGN_CONFIG ?? 'config/mantequilla.json');
const store = storeFromEnv(process.env, () => new MemoryStore(join(process.env.STATE_DIR ?? 'state', 'store.json')));
const attempt = (await store.listAttempts(c.campaignId)).find((a) => a.id === attemptId);
if (!attempt) throw new Error(`No existe el intento ${attemptId}`);

if (verdict === 'confirmed') {
  if (!confirmationId) throw new Error('Falta el localizador oficial');
  const saved = await store.saveReservation({
    campaignId: c.campaignId,
    restaurant: c.restaurant.name,
    date: attempt.date,
    time: attempt.time,
    partySize: c.partySize,
    guestName: process.env.GUEST_FULL_NAME ?? '(ver correo)',
    confirmationId,
    status: 'CONFIRMED',
    confirmedAt: new Date().toISOString(),
    evidence: 'Confirmación verificada manualmente',
  });
  await store.updateAttempt(attempt.id, 'CONFIRMED', confirmationId);
  console.log(saved ? 'Reserva registrada como CONFIRMED. El worker se detendrá.' : 'Ya existía una reserva confirmada para la campaña.');
} else {
  await store.updateAttempt(attempt.id, 'FAILED', 'Verificado manualmente: no se registró la reserva');
  console.log('Intento marcado como no reservado. El worker reanuda la búsqueda.');
}
