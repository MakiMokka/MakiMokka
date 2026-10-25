import type { Transition } from '../core/stateMachine.js';
import type { Attempt, AttemptStatus, DateAvailability, HHmm, IsoDate, Mode, Reservation } from '../core/types.js';

export type EventType =
  | 'MONITORING_STARTED'
  | 'SESSION_EXPIRED'
  | 'AVAILABILITY_FOUND'
  | 'HUMAN_ACTION_REQUIRED'
  | 'RESERVATION_CONFIRMED'
  | 'CRITICAL_ERROR'
  | 'WINDOW_ENDED_NO_AVAILABILITY'
  | 'AVAILABILITY_CHANGED'
  | 'ATTEMPT'
  | 'INFO';

export interface StoredEvent {
  id: string;
  campaignId: string;
  type: EventType;
  message: string;
  data?: Record<string, unknown>;
  at: string;
}

export interface WorkerStatus {
  campaignId: string;
  state: string;
  nextReleaseAt: string | null;
  lastCheckAt: string | null;
  heartbeatAt: string;
  dates: Record<IsoDate, { status: string; slots: HHmm[]; checkedAt: string }>;
  clockOffsetMs?: number;
}

export interface RuntimeSettings {
  mode: Mode;
  paused: boolean;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Persistencia. Las implementaciones deben garantizar atomicidad en lock y reserva. */
export interface Store {
  getConfirmed(campaignId: string): Promise<Reservation | null>;
  /** Guarda la reserva; si ya existe una para la campaña devuelve false sin sobrescribir. */
  saveReservation(r: Reservation): Promise<boolean>;

  /** Lock exclusivo de reservación. Expira tras ttlMs por si el proceso muere. */
  acquireBookingLock(campaignId: string, holder: string, ttlMs: number): Promise<boolean>;
  releaseBookingLock(campaignId: string, holder: string): Promise<void>;

  createAttempt(a: Omit<Attempt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Attempt>;
  updateAttempt(id: string, status: AttemptStatus, detail?: string): Promise<void>;
  /** Intentos enviados cuyo resultado no se verificó: bloquean cualquier intento nuevo. */
  listUnresolvedAttempts(campaignId: string): Promise<Attempt[]>;
  listAttempts(campaignId: string): Promise<Attempt[]>;

  logTransition(campaignId: string, t: Transition): Promise<void>;
  logEvent(e: Omit<StoredEvent, 'id' | 'at'>): Promise<StoredEvent>;
  saveAvailability(campaignId: string, snapshot: DateAvailability[]): Promise<void>;
  setWorkerStatus(s: WorkerStatus): Promise<void>;
  getRuntimeSettings(campaignId: string): Promise<RuntimeSettings | null>;
  listPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
}
