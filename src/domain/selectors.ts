import { chargeStatuses, clientBalance, clientSummary, type ClientSummary } from './ledger';
import { expiryStatus, type ExpiryStatus } from './status';
import type { Account, AppData, Cents, Client, ISODate, Service } from './types';

export interface PendingAssignment {
  service: Service;
  client: Client;
  account: Account;
}

export function pendingAssignments(data: AppData): PendingAssignment[] {
  return data.services
    .filter((s) => s.assignment.status === 'pending')
    .map((service) => ({
      service,
      client: data.clients.find((c) => c.id === service.clientId),
      account: data.accounts.find((a) => a.id === service.accountId),
    }))
    .filter((r): r is PendingAssignment => Boolean(r.client && r.account))
    .sort((a, b) =>
      a.service.requestedOn === b.service.requestedOn
        ? a.service.createdAt.localeCompare(b.service.createdAt)
        : a.service.requestedOn.localeCompare(b.service.requestedOn),
    );
}

export interface AccountRow {
  account: Account;
  client: Client;
  status: ExpiryStatus;
  lastAssigned: Service | null;
  pendingCount: number;
  /** Importe pendiente de los cargos de esta cuenta. */
  outstanding: Cents;
}

export function accountRows(data: AppData, today: ISODate, opts: { includeArchived?: boolean } = {}): AccountRow[] {
  const outstandingByAccount = new Map<string, Cents>();
  for (const client of data.clients) {
    for (const c of chargeStatuses(data, client.id)) {
      if (c.accountId && c.outstanding > 0) {
        outstandingByAccount.set(c.accountId, (outstandingByAccount.get(c.accountId) ?? 0) + c.outstanding);
      }
    }
  }
  const rows: AccountRow[] = [];
  for (const account of data.accounts) {
    if (account.archived && !opts.includeArchived) continue;
    const client = data.clients.find((c) => c.id === account.clientId);
    if (!client) continue;
    const services = data.services.filter((s) => s.accountId === account.id);
    const assigned = services
      .filter((s) => s.assignment.status === 'assigned')
      .sort((a, b) => (a.assignment.confirmedAt ?? '').localeCompare(b.assignment.confirmedAt ?? ''));
    rows.push({
      account,
      client,
      status: expiryStatus(account.expiresAt, today),
      lastAssigned: assigned[assigned.length - 1] ?? null,
      pendingCount: services.filter((s) => s.assignment.status === 'pending').length,
      outstanding: outstandingByAccount.get(account.id) ?? 0,
    });
  }
  return rows.sort(byExpiry);
}

/** Vencimiento más próximo primero; cuentas sin fecha al final. */
function byExpiry(a: AccountRow, b: AccountRow): number {
  const ea = a.account.expiresAt;
  const eb = b.account.expiresAt;
  if (ea === eb) return a.client.name.localeCompare(b.client.name, 'es');
  if (!ea) return 1;
  if (!eb) return -1;
  return ea < eb ? -1 : 1;
}

export type AccountFilter = 'all' | 'active' | 'soon' | 'expired' | 'pending';

export const accountFilterLabels: Record<AccountFilter, string> = {
  all: 'Todas',
  active: 'Activas',
  soon: 'Por vencer',
  expired: 'Vencidas',
  pending: 'Por asignar',
};

export function matchesAccountFilter(row: AccountRow, filter: AccountFilter): boolean {
  const days = row.status.days;
  switch (filter) {
    case 'all':
      return true;
    case 'active':
      return days !== null && days >= 0;
    case 'soon':
      return days !== null && days >= 0 && days <= 7;
    case 'expired':
      return days !== null && days < 0;
    case 'pending':
      return row.pendingCount > 0;
  }
}

const normalize = (s: string) => s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matchesQuery(query: string, ...fields: string[]): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return fields.some((f) => normalize(f).includes(q));
}

export function upcomingExpirations(data: AppData, today: ISODate, withinDays = 7): AccountRow[] {
  return accountRows(data, today).filter((r) => r.status.days !== null && r.status.days >= 0 && r.status.days <= withinDays);
}

export function expiredAccounts(data: AppData, today: ISODate): AccountRow[] {
  return accountRows(data, today).filter((r) => r.status.days !== null && r.status.days < 0);
}

export interface ClientRow {
  client: Client;
  summary: ClientSummary;
  accountCount: number;
  pendingCount: number;
}

export function clientRows(data: AppData, opts: { includeArchived?: boolean } = {}): ClientRow[] {
  return data.clients
    .filter((c) => opts.includeArchived || !c.archived)
    .map((client) => ({
      client,
      summary: clientSummary(data, client.id),
      accountCount: data.accounts.filter((a) => a.clientId === client.id && !a.archived).length,
      pendingCount: data.services.filter((s) => s.clientId === client.id && s.assignment.status === 'pending').length,
    }))
    .sort((a, b) => a.client.name.localeCompare(b.client.name, 'es'));
}

/** Clientes con saldo pendiente, de mayor a menor. */
export function receivables(data: AppData): ClientRow[] {
  return clientRows(data, { includeArchived: true })
    .filter((r) => r.summary.balance > 0)
    .sort((a, b) => b.summary.balance - a.summary.balance);
}

export function hasBalance(data: AppData, clientId: string): boolean {
  return clientBalance(data, clientId) > 0;
}
