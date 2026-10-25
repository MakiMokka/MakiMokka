import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Transition } from '../core/stateMachine.js';
import type { Attempt, AttemptStatus, DateAvailability, Reservation } from '../core/types.js';
import type { PushSubscriptionRecord, RuntimeSettings, Store, StoredEvent, WorkerStatus } from './types.js';

interface Data {
  reservations: Record<string, Reservation>;
  locks: Record<string, { holder: string; expiresAt: number }>;
  attempts: Attempt[];
  transitions: Array<Transition & { campaignId: string }>;
  events: StoredEvent[];
  availability: Record<string, DateAvailability[]>;
  status: Record<string, WorkerStatus>;
  settings: Record<string, RuntimeSettings>;
  push: PushSubscriptionRecord[];
}

const UNRESOLVED: AttemptStatus[] = ['SUBMITTED', 'UNCERTAIN'];

/**
 * Store en memoria con persistencia opcional a un archivo JSON (escritura atómica).
 * Sirve para pruebas y para correr el worker sin Supabase. Un solo proceso.
 */
export class MemoryStore implements Store {
  data: Data;

  constructor(private readonly file?: string) {
    this.data =
      file && existsSync(file)
        ? (JSON.parse(readFileSync(file, 'utf8')) as Data)
        : { reservations: {}, locks: {}, attempts: [], transitions: [], events: [], availability: {}, status: {}, settings: {}, push: [] };
  }

  private flush(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
  }

  async getConfirmed(campaignId: string) {
    return this.data.reservations[campaignId] ?? null;
  }

  async saveReservation(r: Reservation) {
    if (this.data.reservations[r.campaignId]) return false;
    this.data.reservations[r.campaignId] = r;
    this.flush();
    return true;
  }

  async acquireBookingLock(campaignId: string, holder: string, ttlMs: number) {
    const now = Date.now();
    const lock = this.data.locks[campaignId];
    if (lock && lock.expiresAt > now && lock.holder !== holder) return false;
    this.data.locks[campaignId] = { holder, expiresAt: now + ttlMs };
    this.flush();
    return true;
  }

  async releaseBookingLock(campaignId: string, holder: string) {
    if (this.data.locks[campaignId]?.holder === holder) {
      delete this.data.locks[campaignId];
      this.flush();
    }
  }

  async createAttempt(a: Omit<Attempt, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const attempt: Attempt = { ...a, id: randomUUID(), createdAt: now, updatedAt: now };
    this.data.attempts.push(attempt);
    this.flush();
    return attempt;
  }

  async updateAttempt(id: string, status: AttemptStatus, detail?: string) {
    const a = this.data.attempts.find((x) => x.id === id);
    if (!a) throw new Error(`Intento ${id} no existe`);
    a.status = status;
    a.updatedAt = new Date().toISOString();
    if (detail !== undefined) a.detail = detail;
    this.flush();
  }

  async listUnresolvedAttempts(campaignId: string) {
    return this.data.attempts.filter((a) => a.campaignId === campaignId && UNRESOLVED.includes(a.status));
  }

  async listAttempts(campaignId: string) {
    return this.data.attempts.filter((a) => a.campaignId === campaignId);
  }

  async logTransition(campaignId: string, t: Transition) {
    this.data.transitions.push({ ...t, campaignId });
    this.data.transitions = this.data.transitions.slice(-2000);
    this.flush();
  }

  async logEvent(e: Omit<StoredEvent, 'id' | 'at'>) {
    const ev: StoredEvent = { ...e, id: randomUUID(), at: new Date().toISOString() };
    this.data.events.push(ev);
    this.data.events = this.data.events.slice(-2000);
    this.flush();
    return ev;
  }

  async saveAvailability(campaignId: string, snapshot: DateAvailability[]) {
    this.data.availability[campaignId] = snapshot;
    this.flush();
  }

  async setWorkerStatus(s: WorkerStatus) {
    this.data.status[s.campaignId] = s;
    this.flush();
  }

  async getRuntimeSettings(campaignId: string) {
    return this.data.settings[campaignId] ?? null;
  }

  async listPushSubscriptions() {
    return this.data.push;
  }
}
