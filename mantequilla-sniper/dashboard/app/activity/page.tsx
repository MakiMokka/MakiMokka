import { resolveAttempt } from '@/app/actions';
import { AutoRefresh, LocalTime } from '@/components/Live';
import { StatePill } from '@/components/StatePill';
import { activity } from '@/lib/db';

export const dynamic = 'force-dynamic';

const EVENT_TONE: Record<string, string> = {
  RESERVATION_CONFIRMED: 'ok',
  AVAILABILITY_FOUND: 'ok',
  HUMAN_ACTION_REQUIRED: 'bad',
  CRITICAL_ERROR: 'bad',
  SESSION_EXPIRED: 'warn',
  WINDOW_ENDED_NO_AVAILABILITY: '',
  MONITORING_STARTED: 'info',
};

export default async function Activity() {
  const data = await activity();
  if (!data) return <main><h1>Actividad</h1><p className="notice">Supabase no está configurado.</p></main>;
  const unresolved = data.attempts.filter((a) => a.status === 'UNCERTAIN' || a.status === 'SUBMITTED');
  const notifications = data.events.filter((e) => e.type !== 'AVAILABILITY_CHANGED' && e.type !== 'INFO');
  const changes = data.events.filter((e) => e.type === 'AVAILABILITY_CHANGED');
  const errors = data.transitions.filter((t) => t.to_state === 'FAILED' || t.to_state === 'RATE_LIMITED' || t.to_state === 'SESSION_EXPIRED');

  return (
    <main>
      <AutoRefresh />
      <h1>Actividad</h1>

      {unresolved.length > 0 && (
        <>
          <h2>Requiere verificación</h2>
          {unresolved.map((a) => (
            <form key={a.id} action={resolveAttempt} className="card stack">
              <strong>Envío sin confirmación verificable: {a.date} {a.time.slice(0, 5)}</strong>
              <p className="sub">Revisa el correo de CoverManager. Mientras esté sin resolver, el robot no hará más intentos.</p>
              <input type="hidden" name="attemptId" value={a.id} />
              <input name="confirmationId" placeholder="Localizador del correo de confirmación" />
              <div className="grid2">
                <button className="primary" name="verdict" value="confirmed">Sí se reservó</button>
                <button name="verdict" value="not-booked">No se reservó</button>
              </div>
            </form>
          ))}
        </>
      )}

      <h2>Notificaciones</h2>
      <div className="card">
        <ul className="list">
          {notifications.length === 0 && <li className="sub">Sin notificaciones todavía.</li>}
          {notifications.map((e) => (
            <li key={e.id}>
              <div className="row"><span className={`pill ${EVENT_TONE[e.type] ?? ''}`}>{e.type.replaceAll('_', ' ').toLowerCase()}</span><span className="time"><LocalTime iso={e.at} /></span></div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{e.message}</div>
            </li>
          ))}
        </ul>
      </div>

      <h2>Intentos de reservación</h2>
      <div className="card">
        <ul className="list">
          {data.attempts.length === 0 && <li className="sub">Sin intentos.</li>}
          {data.attempts.map((a) => (
            <li key={a.id} className="row">
              <span>{a.date} · {a.time.slice(0, 5)}<br /><span className="time">{a.detail ?? ''}</span></span>
              <StatePill state={a.status} />
            </li>
          ))}
        </ul>
      </div>

      <h2>Disponibilidad detectada</h2>
      <div className="card">
        <ul className="list">
          {changes.length === 0 && <li className="sub">Sin cambios registrados.</li>}
          {changes.slice(0, 40).map((e) => (
            <li key={e.id} className="row"><span className="mono">{e.message}</span><span className="time"><LocalTime iso={e.at} withDate={false} /></span></li>
          ))}
        </ul>
      </div>

      <h2>Errores</h2>
      <div className="card">
        <ul className="list">
          {errors.length === 0 && <li className="sub">Sin errores.</li>}
          {errors.slice(0, 30).map((t) => (
            <li key={t.id}><div className="row"><StatePill state={t.to_state} /><span className="time"><LocalTime iso={t.at} /></span></div><div className="time" style={{ marginTop: 4 }}>{t.reason}</div></li>
          ))}
        </ul>
      </div>

      <h2>Historial de ejecución</h2>
      <div className="card">
        <ul className="list">
          {data.transitions.slice(0, 60).map((t) => (
            <li key={t.id}>
              <div className="row"><span className="mono">{t.from_state} → {t.to_state}</span><span className="time"><LocalTime iso={t.at} withDate={false} /></span></div>
              <div className="time">{t.reason}</div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
