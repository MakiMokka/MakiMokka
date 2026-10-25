const TONE: Record<string, 'ok' | 'warn' | 'bad' | 'info' | ''> = {
  CONFIRMED: 'ok',
  AVAILABLE: 'ok',
  SLOT_FOUND: 'ok',
  READY: 'info',
  WAITING_FOR_RELEASE: 'info',
  CHECKING_AVAILABILITY: 'info',
  FILLING_FORM: 'info',
  AWAITING_CONFIRMATION: 'warn',
  INITIALIZING: 'info',
  HUMAN_ACTION_REQUIRED: 'bad',
  SESSION_EXPIRED: 'warn',
  RATE_LIMITED: 'warn',
  FAILED: 'bad',
  ERROR: 'bad',
  UNKNOWN: 'warn',
  SOLD_OUT: '',
  UNAVAILABLE: '',
  NOT_YET_RELEASED: '',
  NO_AVAILABILITY: '',
};

const LABEL: Record<string, string> = {
  AVAILABLE: 'Disponible',
  SOLD_OUT: 'Agotado',
  UNAVAILABLE: 'Sin mesas',
  NOT_YET_RELEASED: 'Aún no abre',
  UNKNOWN: 'Incierto',
  ERROR: 'Error de lectura',
  CONFIRMED: 'Confirmada',
  HUMAN_ACTION_REQUIRED: 'Acción requerida',
};

export function StatePill({ state }: { state: string }) {
  return (
    <span className={`pill ${TONE[state] ?? ''}`}>
      <span className="dot" aria-hidden />
      {LABEL[state] ?? state.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
