import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { chargeStatuses, clientSummary, ledgerRows, totalReceivable } from './ledger';
import {
  cancelService,
  confirmAssignment,
  createAccount,
  createClient,
  registerAdjustment,
  registerPayment,
  registerService,
  updateClient,
  type OpContext,
} from './operations';
import { accountRows, pendingAssignments, upcomingExpirations } from './selectors';
import { expiryStatus } from './status';
import { emptyData, type AppData } from './types';
import { validateAssignment, validatePayment, validateService, NEW_ACCOUNT } from './validation';

function ctx(): OpContext {
  let n = 0;
  let t = Date.UTC(2026, 9, 1, 12);
  return {
    get now() {
      t += 1000;
      return new Date(t);
    },
    newId: () => `id${++n}`,
  };
}

function setup() {
  const c = ctx();
  let data: AppData = emptyData();
  const r1 = createClient(data, { name: 'Ana', phone: '5512345678', email: '', pricePerCredit: 15000, notes: '' }, c);
  data = r1.data;
  const r2 = createAccount(
    data,
    { clientId: r1.client.id, alias: 'Sala', username: 'ana.sala', plan: 'Plus', expiresAt: '2026-10-25', notes: '' },
    c,
  );
  data = r2.data;
  return { c, data, client: r1.client, account: r2.account };
}

describe('registrar servicio', () => {
  it('calcula el total, guarda el precio aplicado y no cambia el vencimiento', () => {
    const { c, data, client, account } = setup();
    const { data: next, service } = registerService(
      data,
      {
        clientId: client.id,
        accountId: account.id,
        newAccount: null,
        credits: 3,
        unitPrice: 12000,
        amountPaid: 0,
        method: null,
        notes: '',
        requestedOn: '2026-10-20',
      },
      c,
    );
    expect(service.total).toBe(36000);
    expect(service.unitPrice).toBe(12000);
    expect(service.assignment.status).toBe('pending');
    expect(next.accounts.find((a) => a.id === account.id)?.expiresAt).toBe('2026-10-25');
    expect(clientSummary(next, client.id).balance).toBe(36000);
    expect(pendingAssignments(next)).toHaveLength(1);
  });

  it('admite pago parcial y actualiza el saldo al instante', () => {
    const { c, data, client, account } = setup();
    const { data: next } = registerService(
      data,
      {
        clientId: client.id,
        accountId: account.id,
        newAccount: null,
        credits: 2,
        unitPrice: 15000,
        amountPaid: 10000,
        method: 'cash',
        notes: '',
        requestedOn: '2026-10-20',
      },
      c,
    );
    const s = clientSummary(next, client.id);
    expect(s.balance).toBe(20000);
    expect(s.paymentState).toBe('partial');
  });

  it('crea la cuenta nueva sin vencimiento', () => {
    const { c, data, client } = setup();
    const { data: next, service } = registerService(
      data,
      {
        clientId: client.id,
        accountId: null,
        newAccount: { alias: 'Cocina', username: 'ana.cocina', plan: '' },
        credits: 1,
        unitPrice: 15000,
        amountPaid: 15000,
        method: 'transfer',
        notes: '',
        requestedOn: '2026-10-20',
      },
      c,
    );
    const acc = next.accounts.find((a) => a.id === service.accountId);
    expect(acc?.alias).toBe('Cocina');
    expect(acc?.expiresAt).toBeNull();
    expect(clientSummary(next, client.id).paymentState).toBe('paid');
  });

  it('valida que el pago no supere el total y que haya método', () => {
    const { data, client, account } = setup();
    const base = {
      clientId: client.id,
      accountId: account.id,
      newAlias: '',
      newUsername: '',
      newPlan: '',
      credits: '2',
      unitPrice: '100',
      amountPaid: '300',
      method: '' as const,
      notes: '',
      requestedOn: '2026-10-20',
    };
    const r = validateService(base, data);
    expect(r.errors.amountPaid).toMatch(/superar el total/);
    const r2 = validateService({ ...base, amountPaid: '50' }, data);
    expect(r2.errors.method).toBeDefined();
    const r3 = validateService({ ...base, credits: '1.5' }, data);
    expect(r3.errors.credits).toMatch(/entero/);
    const r4 = validateService({ ...base, accountId: NEW_ACCOUNT, newUsername: 'ANA.SALA', newAlias: 'x', amountPaid: '' }, data);
    expect(r4.errors.newUsername).toMatch(/Ya existe/);
  });
});

describe('precio histórico', () => {
  it('cambiar el precio habitual no altera operaciones anteriores', () => {
    const { c, data, client, account } = setup();
    const { data: d1, service } = registerService(
      data,
      {
        clientId: client.id,
        accountId: account.id,
        newAccount: null,
        credits: 2,
        unitPrice: 15000,
        amountPaid: 0,
        method: null,
        notes: '',
        requestedOn: '2026-10-20',
      },
      c,
    );
    const d2 = updateClient(d1, client.id, { name: 'Ana', phone: '5512345678', email: '', pricePerCredit: 20000, notes: '' }, c);
    const updated = d2.clients.find((x) => x.id === client.id)!;
    expect(updated.pricePerCredit).toBe(20000);
    expect(updated.priceHistory.map((p) => p.price)).toEqual([15000, 20000]);
    expect(d2.services.find((s) => s.id === service.id)?.unitPrice).toBe(15000);
    expect(d2.movements.find((m) => m.type === 'charge')?.amount).toBe(30000);
    expect(clientSummary(d2, client.id).balance).toBe(30000);
  });
});

describe('confirmar asignación', () => {
  it('usa la fecha del portal como fuente de verdad y conserva historial', () => {
    const { c, data, client, account } = setup();
    const { data: d1, service } = registerService(
      data,
      {
        clientId: client.id,
        accountId: account.id,
        newAccount: null,
        credits: 1,
        unitPrice: 15000,
        amountPaid: 0,
        method: null,
        notes: '',
        requestedOn: '2026-10-20',
      },
      c,
    );
    const d2 = confirmAssignment(
      d1,
      service.id,
      { assignedOn: '2026-10-21', portalExpiresAt: '2026-11-27', confirmedBy: 'Ceci', note: '' },
      c,
    );
    const acc = d2.accounts.find((a) => a.id === account.id)!;
    expect(acc.expiresAt).toBe('2026-11-27');
    expect(acc.expiryHistory.map((h) => h.next)).toEqual(['2026-10-25', '2026-11-27']);
    const s = d2.services.find((x) => x.id === service.id)!;
    expect(s.assignment).toMatchObject({ status: 'assigned', confirmedBy: 'Ceci', previousExpiresAt: '2026-10-25' });
    expect(s.assignment.confirmedAt).toBeTruthy();
    expect(pendingAssignments(d2)).toHaveLength(0);
    // Confirmar no toca el saldo: pago y asignación son independientes.
    expect(clientSummary(d2, client.id).balance).toBe(15000);
    expect(() =>
      confirmAssignment(d2, service.id, { assignedOn: '2026-10-21', portalExpiresAt: '2026-11-27', confirmedBy: 'Ceci', note: '' }, c),
    ).toThrow();
  });

  it('rechaza fechas incoherentes', () => {
    const r = validateAssignment({ assignedOn: '2026-10-21', portalExpiresAt: '2026-10-01', confirmedBy: 'x', note: '' }, '2026-10-22');
    expect(r.errors.portalExpiresAt).toBeDefined();
    const r2 = validateAssignment({ assignedOn: '2026-10-30', portalExpiresAt: '2026-11-30', confirmedBy: '', note: '' }, '2026-10-22');
    expect(r2.errors.assignedOn).toMatch(/futura/);
    expect(r2.errors.confirmedBy).toBeDefined();
  });
});

describe('días restantes', () => {
  it('se calculan contra la fecha actual en cada consulta', () => {
    expect(expiryStatus('2026-10-25', '2026-10-22')).toMatchObject({ days: 3, kind: 'critical' });
    expect(expiryStatus('2026-10-25', '2026-10-25')).toMatchObject({ days: 0, kind: 'today', label: 'Vence hoy' });
    expect(expiryStatus('2026-10-25', '2026-10-27')).toMatchObject({ days: -2, kind: 'expired', tone: 'coral' });
    expect(expiryStatus('2026-10-29', '2026-10-22')).toMatchObject({ kind: 'soon', tone: 'yellow' });
    expect(expiryStatus('2026-11-29', '2026-10-22')).toMatchObject({ kind: 'ok', tone: 'green' });
    expect(expiryStatus(null, '2026-10-22').kind).toBe('none');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('filtra próximos vencimientos dentro de siete días', () => {
    const { data } = setup();
    expect(upcomingExpirations(data, '2026-10-22')).toHaveLength(1);
    expect(upcomingExpirations(data, '2026-10-10')).toHaveLength(0);
    expect(accountRows(data, '2026-10-26')[0]?.status.kind).toBe('expired');
  });
});

describe('pagos', () => {
  function withTwoCharges() {
    const s = setup();
    let d = s.data;
    d = registerService(
      d,
      {
        clientId: s.client.id,
        accountId: s.account.id,
        newAccount: null,
        credits: 1,
        unitPrice: 10000,
        amountPaid: 0,
        method: null,
        notes: '',
        requestedOn: '2026-10-01',
      },
      s.c,
    ).data;
    d = registerService(
      d,
      {
        clientId: s.client.id,
        accountId: s.account.id,
        newAccount: null,
        credits: 2,
        unitPrice: 10000,
        amountPaid: 0,
        method: null,
        notes: '',
        requestedOn: '2026-10-10',
      },
      s.c,
    ).data;
    return { ...s, data: d };
  }

  it('un pago general se aplica al cargo más antiguo', () => {
    const { c, data, client } = withTwoCharges();
    const d = registerPayment(
      data,
      { clientId: client.id, amount: 15000, method: 'cash', date: '2026-10-15', reference: '', chargeIds: [] },
      c,
    );
    const statuses = chargeStatuses(d, client.id);
    expect(statuses.map((s) => s.outstanding)).toEqual([0, 15000]);
    expect(clientSummary(d, client.id).balance).toBe(15000);
  });

  it('un pago dirigido se aplica solo a los cargos elegidos', () => {
    const { c, data, client } = withTwoCharges();
    const second = chargeStatuses(data, client.id)[1]!;
    const d = registerPayment(
      data,
      { clientId: client.id, amount: 20000, method: 'transfer', date: '2026-10-15', reference: 'SPEI 123', chargeIds: [second.chargeId] },
      c,
    );
    expect(chargeStatuses(d, client.id).map((s) => s.outstanding)).toEqual([10000, 0]);
    const v = validatePayment(
      {
        clientId: client.id,
        amount: '300',
        method: 'cash',
        date: '2026-10-15',
        reference: '',
        target: 'charges',
        chargeIds: [second.chargeId],
      },
      data,
    );
    expect(v.errors.amount).toMatch(/supera/);
  });

  it('los saldos resultantes del historial son correctos', () => {
    const { c, data, client } = withTwoCharges();
    let d = registerPayment(
      data,
      { clientId: client.id, amount: 5000, method: 'cash', date: '2026-10-15', reference: '', chargeIds: [] },
      c,
    );
    d = registerAdjustment(d, client.id, { amount: -1000, date: '2026-10-16', note: 'Descuento' }, c);
    expect(ledgerRows(d, client.id).map((r) => r.balanceAfter)).toEqual([10000, 30000, 25000, 24000]);
    expect(totalReceivable(d)).toBe(24000);
  });

  it('cancelar un servicio pendiente anula su cargo', () => {
    const { c, data, client } = withTwoCharges();
    const svc = data.services[1]!;
    const d = cancelService(data, svc.id, 'Cliente desistió', '2026-10-12', c);
    expect(clientSummary(d, client.id).balance).toBe(10000);
    expect(d.services[1]!.assignment.status).toBe('cancelled');
    expect(pendingAssignments(d)).toHaveLength(1);
  });
});
