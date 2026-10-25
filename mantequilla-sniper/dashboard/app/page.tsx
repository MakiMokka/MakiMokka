import { AutoRefresh, Countdown, LocalTime } from '@/components/Live';
import { StatePill } from '@/components/StatePill';
import { campaign, overview } from '@/lib/db';

export const dynamic = 'force-dynamic';

function humanDate(iso: string) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00Z`));
}

/** Respaldo si el worker aún no publicó la próxima apertura: primera apertura candidata futura según la configuración. */
function nextReleaseFromConfig(): string | null {
  const now = Date.now();
  const instants = campaign.targets.flatMap((t) =>
    campaign.release.daysAheadCandidates.map((k) => {
      // CDMX no tiene horario de verano desde 2022: UTC-6 fijo.
      const d = new Date(`${t.date}T${campaign.release.time}:00-06:00`);
      d.setUTCDate(d.getUTCDate() - k);
      return d.getTime();
    }),
  );
  const next = instants.filter((ms) => ms > now).sort((a, b) => a - b)[0];
  return next ? new Date(next).toISOString() : null;
}

export default async function Home() {
  const data = await overview();
  const status = data?.status ?? null;
  const heartbeatAge = status ? Date.now() - Date.parse(status.heartbeat_at) : Infinity;
  const workerAlive = heartbeatAge < 120_000;
  const byDate = new Map((data?.availability ?? []).map((a) => [a.date, a]));
  const nextRelease = status?.next_release_at ?? nextReleaseFromConfig();

  return (
    <main>
      <AutoRefresh />
      <p className="sub">{campaign.restaurant.name} · {campaign.partySize} personas</p>
      <h1>Robot de reservación</h1>

      {!data && <p className="notice">Supabase no está configurado: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.</p>}

      {data?.reservation && (
        <>
          <h2>Reservación</h2>
          <div className="card confirmed stack">
            <span className="pill ok"><span className="dot" />Reserva confirmada</span>
            <div className="big">{data.reservation.time.slice(0, 5)}</div>
            <div>{humanDate(data.reservation.date)}</div>
            <div className="grid2">
              <div><div className="label">Nombre</div>{data.reservation.guest_name}</div>
              <div><div className="label">Personas</div>{data.reservation.party_size}</div>
            </div>
            <div><div className="label">Confirmación</div><span className="mono">{data.reservation.confirmation_id}</span></div>
          </div>
        </>
      )}

      <h2>Estado</h2>
      <div className="grid2">
        <div className="card stack">
          <span className="label">Robot</span>
          <StatePill state={status?.state ?? 'IDLE'} />
          <span className="time">{workerAlive ? 'Worker activo' : status ? 'Sin latido reciente' : 'Sin datos del worker'}</span>
        </div>
        <div className="card stack">
          <span className="label">Modo</span>
          <span className={`pill ${data?.settings.mode === 'AUTO' ? 'ok' : 'info'}`}>{data?.settings.mode === 'AUTO' ? 'Automático' : 'Asistido'}</span>
          {data?.settings.paused && <span className="pill warn">En pausa</span>}
        </div>
      </div>

      {!data?.reservation && nextRelease && (
        <>
          <h2>Próxima apertura</h2>
          <div className="card stack">
            <Countdown to={nextRelease} />
            <span className="sub"><LocalTime iso={nextRelease} /> · hora de Ciudad de México</span>
          </div>
        </>
      )}

      <h2>Fechas objetivo</h2>
      <div className="stack">
        {campaign.targets.map((t) => {
          const a = byDate.get(t.date);
          return (
            <div key={t.date} className="card">
              <div className="row">
                <div>
                  <strong>{t.priority}. {t.label}</strong>
                  <div className="time">
                    {'minTime' in t && t.minTime ? `Desde ${t.minTime}` : 'Comida o cena'}
                    {'preferredTimes' in t && t.preferredTimes ? ` · preferidos ${t.preferredTimes.join(', ')}` : ''}
                  </div>
                </div>
                <StatePill state={a?.status ?? 'NOT_YET_RELEASED'} />
              </div>
              {a && a.slots.length > 0 && (
                <div className="slots">{a.slots.map((s) => <span key={s} className="slot">{s}</span>)}</div>
              )}
              {a && <div className="time" style={{ marginTop: 8 }}>Consultado <LocalTime iso={a.checked_at} withDate={false} />{a.detail ? ` · ${a.detail}` : ''}</div>}
            </div>
          );
        })}
      </div>

      <h2>Última consulta</h2>
      <div className="card"><LocalTime iso={status?.last_check_at ?? null} /></div>
    </main>
  );
}
