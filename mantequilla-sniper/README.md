# Mantequilla Reservation Sniper

Sistema privado para conseguir **una** reservación para 2 personas en Mantequilla Social Club (CoverManager, CDMX) en las fechas objetivo de noviembre de 2026.

- **Worker** (`src/`): Node + Playwright. Es un servicio persistente que se prepara antes de cada apertura diaria (12:00 CDMX, configurable), detecta mesas, elige la mejor opción, reserva (cuando está autorizado) y notifica.
- **Dashboard** (`dashboard/`): Next.js, mobile‑first, para Vercel. Muestra estado, cuenta regresiva, fechas, actividad y configuración, y permite activar push.
- **Base de datos**: Supabase (`supabase/migrations/001_init.sql`). Sin Supabase, el worker usa `state/store.json`.

Informe de viabilidad y estado de la investigación: [`docs/FEASIBILITY.md`](docs/FEASIBILITY.md).

## Arquitectura

```
config/mantequilla.json      fechas, prioridades, horarios, apertura, frecuencias (sin datos personales)
src/core/                    tipos, config, motor de preferencias, máquina de estados, redacción de PII, logs
src/availability/engine.ts   detección: dedupe, filtros, clasificación AVAILABLE/SOLD_OUT/NOT_YET_RELEASED/UNKNOWN/ERROR, cambios
src/booking/engine.ts        reservación: lock, intento SUBMITTED antes del clic, UNCERTAIN bloquea, CONFIRMED solo con localizador
src/scheduler/               calendario de aperturas, reloj corregido, secuencia T-120 / T-30 / T=0, monitoreo de cancelaciones
src/adapters/                contrato RestaurantAdapter; covermanager/ (Playwright) y simulated (pruebas)
src/notify/                  dashboard (tabla events), email SMTP, Web Push
src/orchestrator.ts          un ciclo: guardas → disponibilidad → selección → reservación
scripts/recon.ts             Fase 1: inspección de la página real (nunca envía)
scripts/plan.ts              calendario de oportunidades
scripts/resolve.ts           resolver a mano un envío sin confirmación verificable
```

Para usarlo con otro restaurante: nuevo `config/*.json` (`CAMPAIGN_CONFIG=...`) y, si es otra plataforma, un adapter nuevo que implemente `RestaurantAdapter`.

### Garantías contra duplicados

1. `reservations.campaign_id` es PK: la base de datos no admite una segunda reserva por campaña.
2. Lock de reservación atómico con expiración (`acquire_booking_lock`).
3. El intento se guarda como `SUBMITTED` **antes** del clic de envío. Si después no hay localizador verificable (se cae el navegador, timeout, CAPTCHA tras enviar), queda `UNCERTAIN`. Ningún worker vuelve a intentar hasta que una persona lo resuelva en el dashboard (Actividad → "Sí se reservó / No se reservó") o con `npm run resolve`.
4. Toda ejecución empieza revisando si ya existe una reserva confirmada; si existe, termina sin tocar CoverManager.

### Lo que el robot nunca hace

No evade CAPTCHA ni protecciones anti‑bot. No llama endpoints internos. No consulta más rápido que `polling.minIntervalMs` (3 s). No acepta depósitos ni tarjetas de garantía. No inventa datos para campos desconocidos. No agrega comentarios ni celebraciones, y no marca casillas de publicidad.

## Puesta en marcha

```bash
cd mantequilla-sniper
npm install
cp .env.example .env          # llenar GUEST_*, y opcionalmente Supabase/SMTP/VAPID
npm test                      # 39 pruebas: 10 escenarios + reglas + adapter contra página sintética
npm run plan                  # calendario de aperturas
```

### 1. Verificar contra CoverManager real (obligatorio antes de AUTO)

Desde una máquina con acceso a covermanager.com:

```bash
npm run recon                                   # recon-output/report.md, aria-*.yml, network.json, capturas
npm run recon -- --dry-run-form 2026-10-28      # una fecha abierta NO objetivo: llena con datos de prueba, no envía
```

Ajusta `src/adapters/covermanager/selectors.ts` y `config/mantequilla.json` (`release.daysAheadCandidates`) según el reporte. El dry run debe devolver `READY_NOT_SUBMITTED`. Solo entonces pon `COVERMANAGER_ADAPTER_VERIFIED=true` y `BOOKING_MODE=AUTO`.

### 2. Supabase

Crea un proyecto, ejecuta `supabase/migrations/001_init.sql` en el SQL editor y usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en el worker y en el dashboard (solo del lado del servidor).

### 3. Worker (servicio persistente, sin tu computadora)

Fly.io (región Querétaro):

```bash
fly launch --no-deploy --copy-config
fly volumes create sniper_state --size 1 --region qro
fly secrets set GUEST_FULL_NAME="..." GUEST_PHONE="..." GUEST_EMAIL="..." \
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SMTP_URL=... NOTIFY_EMAIL_TO=... \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
fly deploy
```

Cualquier host de contenedores siempre encendido sirve (Railway, Render, una VM). Vercel Cron **no** sirve para el worker: no da precisión de segundos ni procesos largos con navegador.

### 4. Dashboard (Vercel)

Root directory `mantequilla-sniper/dashboard`. Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, y opcionalmente `GUEST_*` (se muestran enmascarados). Abre el dashboard en el teléfono → Configuración → "Activar notificaciones push" (en iPhone, primero "Agregar a pantalla de inicio").

## Estados

`IDLE → INITIALIZING → READY → WAITING_FOR_RELEASE → CHECKING_AVAILABILITY → SLOT_FOUND → FILLING_FORM → AWAITING_CONFIRMATION → CONFIRMED`, con alternativos `NO_AVAILABILITY, NOT_YET_RELEASED, SESSION_EXPIRED, HUMAN_ACTION_REQUIRED, RATE_LIMITED, FAILED`. Cada transición queda en la tabla `transitions` y en el log JSON.
