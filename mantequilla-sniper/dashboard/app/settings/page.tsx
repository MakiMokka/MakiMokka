import { updateSettings } from '@/app/actions';
import { PushButton } from '@/components/PushButton';
import { campaign, overview } from '@/lib/db';

export const dynamic = 'force-dynamic';

function maskEmail(v?: string) {
  if (!v) return 'No configurado';
  const [u = '', d = ''] = v.split('@');
  return `${u.slice(0, 2)}***@${d}`;
}
function maskPhone(v?: string) {
  if (!v) return 'No configurado';
  return `•••• ${v.replace(/\D/g, '').slice(-4)}`;
}

export default async function Settings() {
  const data = await overview();
  const settings = data?.settings ?? { mode: 'ASSISTED' as const, paused: false };
  return (
    <main>
      <h1>Configuración</h1>

      <h2>Modo de operación</h2>
      <form action={updateSettings} className="card stack">
        <fieldset>
          <div className="seg">
            <label><input type="radio" name="mode" value="ASSISTED" defaultChecked={settings.mode === 'ASSISTED'} /> Asistido</label>
            <label><input type="radio" name="mode" value="AUTO" defaultChecked={settings.mode === 'AUTO'} /> Automático</label>
          </div>
          <p className="sub">Automático solo envía el formulario si el adapter fue verificado contra CoverManager (COVERMANAGER_ADAPTER_VERIFIED=true en el worker). En asistido recibes el aviso con el link y reservas tú.</p>
          <label className="row"><span>Pausar el robot</span><input type="checkbox" name="paused" defaultChecked={settings.paused} style={{ width: 'auto' }} /></label>
        </fieldset>
        <button className="primary" disabled={!data}>Guardar</button>
      </form>

      <h2>Notificaciones</h2>
      <div className="card stack">
        <PushButton vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''} />
        <p className="sub">El correo se configura en el worker (SMTP_URL, NOTIFY_EMAIL_TO). El dashboard siempre registra cada aviso en Actividad.</p>
      </div>

      <h2>Datos del cliente</h2>
      <div className="card stack">
        <div className="row"><span className="label">Nombre</span><span>{process.env.GUEST_FULL_NAME ?? 'No configurado'}</span></div>
        <div className="row"><span className="label">Teléfono</span><span className="mono">{maskPhone(process.env.GUEST_PHONE)}</span></div>
        <div className="row"><span className="label">Correo</span><span className="mono">{maskEmail(process.env.GUEST_EMAIL)}</span></div>
        <div className="row"><span className="label">Personas</span><span>{campaign.partySize}</span></div>
        <div className="row"><span className="label">¿Festejas algo?</span><span>No</span></div>
        <p className="sub">Los datos personales viven solo en variables de entorno del worker; no se guardan en la base de datos.</p>
      </div>

      <h2>Fechas y horarios</h2>
      <div className="card">
        <ul className="list">
          {campaign.targets.map((t) => (
            <li key={t.date}>
              <strong>{t.priority}. {t.label}</strong>
              <div className="time">
                {'minTime' in t && t.minTime ? `Mínimo ${t.minTime}` : 'Cualquier horario de comida o cena'}
                {'preferredTimes' in t && t.preferredTimes ? ` · preferidos ${t.preferredTimes.join(', ')}` : ''}
              </div>
              <div className="time">Referencia: {t.referenceTimes.join(' · ')}</div>
            </li>
          ))}
        </ul>
      </div>

      <h2>Apertura de reservaciones</h2>
      <div className="card stack">
        <div className="row"><span className="label">Hora</span><span>{campaign.release.times.join(' o ')} · {campaign.restaurant.timezone}</span></div>
        <div className="row"><span className="label">Días de anticipación (candidatos)</span><span>{campaign.release.daysAheadCandidates.join(', ')}</span></div>
        <p className="sub">{campaign.release.note}</p>
        <p className="sub">Para cambiarlos edita config/mantequilla.json y vuelve a desplegar el worker.</p>
      </div>
    </main>
  );
}
