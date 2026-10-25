export const MAIN_STATES = [
  'IDLE',
  'INITIALIZING',
  'AUTHENTICATING',
  'READY',
  'WAITING_FOR_RELEASE',
  'CHECKING_AVAILABILITY',
  'SLOT_FOUND',
  'FILLING_FORM',
  'AWAITING_CONFIRMATION',
  'CONFIRMED',
] as const;

export const ALT_STATES = [
  'NO_AVAILABILITY',
  'NOT_YET_RELEASED',
  'SESSION_EXPIRED',
  'HUMAN_ACTION_REQUIRED',
  'RATE_LIMITED',
  'FAILED',
] as const;

export type BotState = (typeof MAIN_STATES)[number] | (typeof ALT_STATES)[number];

const T: Record<BotState, BotState[]> = {
  IDLE: ['INITIALIZING', 'CONFIRMED', 'HUMAN_ACTION_REQUIRED'],
  INITIALIZING: ['AUTHENTICATING', 'READY', 'FAILED', 'SESSION_EXPIRED', 'HUMAN_ACTION_REQUIRED', 'RATE_LIMITED', 'IDLE'],
  AUTHENTICATING: ['READY', 'SESSION_EXPIRED', 'HUMAN_ACTION_REQUIRED', 'FAILED'],
  READY: ['WAITING_FOR_RELEASE', 'CHECKING_AVAILABILITY', 'IDLE', 'FAILED'],
  WAITING_FOR_RELEASE: ['CHECKING_AVAILABILITY', 'INITIALIZING', 'READY', 'IDLE', 'FAILED'],
  CHECKING_AVAILABILITY: [
    'SLOT_FOUND',
    'NO_AVAILABILITY',
    'NOT_YET_RELEASED',
    'SESSION_EXPIRED',
    'HUMAN_ACTION_REQUIRED',
    'RATE_LIMITED',
    'FAILED',
    'READY',
  ],
  SLOT_FOUND: ['FILLING_FORM', 'CHECKING_AVAILABILITY', 'HUMAN_ACTION_REQUIRED', 'READY', 'FAILED'],
  FILLING_FORM: [
    'AWAITING_CONFIRMATION',
    'CHECKING_AVAILABILITY',
    'HUMAN_ACTION_REQUIRED',
    'SESSION_EXPIRED',
    'RATE_LIMITED',
    'READY',
    'FAILED',
  ],
  AWAITING_CONFIRMATION: ['CONFIRMED', 'HUMAN_ACTION_REQUIRED', 'CHECKING_AVAILABILITY', 'FAILED'],
  CONFIRMED: [],
  NO_AVAILABILITY: ['READY', 'WAITING_FOR_RELEASE', 'CHECKING_AVAILABILITY', 'IDLE'],
  NOT_YET_RELEASED: ['READY', 'WAITING_FOR_RELEASE', 'CHECKING_AVAILABILITY', 'IDLE'],
  SESSION_EXPIRED: ['INITIALIZING', 'IDLE', 'FAILED'],
  HUMAN_ACTION_REQUIRED: ['INITIALIZING', 'IDLE', 'READY', 'CONFIRMED'],
  RATE_LIMITED: ['READY', 'WAITING_FOR_RELEASE', 'CHECKING_AVAILABILITY', 'INITIALIZING', 'IDLE'],
  FAILED: ['INITIALIZING', 'IDLE'],
};

export interface Transition {
  from: BotState;
  to: BotState;
  reason: string;
  at: string;
}

export class InvalidTransitionError extends Error {}

/** Máquina de estados con transiciones explícitas; CONFIRMED es terminal. */
export class StateMachine {
  private current: BotState;

  constructor(
    initial: BotState,
    private readonly onTransition: (t: Transition) => void | Promise<void>,
  ) {
    this.current = initial;
  }

  get state(): BotState {
    return this.current;
  }

  canGo(to: BotState): boolean {
    return to === this.current || T[this.current].includes(to);
  }

  async go(to: BotState, reason: string): Promise<void> {
    if (to === this.current) return;
    if (!T[this.current].includes(to)) {
      throw new InvalidTransitionError(`Transición inválida ${this.current} → ${to} (${reason})`);
    }
    const t: Transition = { from: this.current, to, reason, at: new Date().toISOString() };
    this.current = to;
    await this.onTransition(t);
  }
}
