import { isValidISODate } from './dates';
import { openCharges } from './ledger';
import { parseMoney } from './money';
import type { AppData, Cents, ISODate, PaymentMethod } from './types';

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export interface Validated<T, K extends string> {
  errors: FieldErrors<K>;
  value: T | null;
}

const ok = <T, K extends string>(errors: FieldErrors<K>, build: () => T): Validated<T, K> =>
  Object.keys(errors).length > 0 ? { errors, value: null } : { errors, value: build() };

const MAX_AMOUNT: Cents = 100_000_000; // $1,000,000.00

function money(
  raw: string,
  field: string,
  opts: { allowZero?: boolean; allowNegative?: boolean } = {},
): [Cents | null, string | undefined] {
  if (raw.trim() === '') return [null, `Escribe ${field}.`];
  const value = parseMoney(raw);
  if (value === null) return [null, `Escribe ${field} con números, por ejemplo 150 o 150.50.`];
  if (!opts.allowNegative && value < 0) return [null, `${capitalize(field)} no puede ser negativo.`];
  if (!opts.allowZero && value === 0) return [null, `${capitalize(field)} debe ser mayor que cero.`];
  if (Math.abs(value) > MAX_AMOUNT) return [null, `${capitalize(field)} parece demasiado alto. Revisa la cifra.`];
  return [value, undefined];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function date(raw: string, field: string): string | undefined {
  if (!raw) return `Selecciona ${field}.`;
  if (!isValidISODate(raw)) return `${capitalize(field)} no es una fecha válida.`;
  return undefined;
}

/* ---------- Cliente ---------- */

export interface ClientDraft {
  name: string;
  phone: string;
  email: string;
  pricePerCredit: string;
  notes: string;
}

export interface ClientInput {
  name: string;
  phone: string;
  email: string;
  pricePerCredit: Cents;
  notes: string;
}

export function validateClient(d: ClientDraft): Validated<ClientInput, keyof ClientDraft> {
  const errors: FieldErrors<keyof ClientDraft> = {};
  const name = d.name.trim();
  if (!name) errors.name = 'Escribe el nombre del cliente.';
  const phone = d.phone.trim();
  const digits = phone.replace(/\D/g, '');
  if (!phone) errors.phone = 'Escribe un teléfono de contacto.';
  else if (digits.length < 8 || digits.length > 15) errors.phone = 'El teléfono debe tener entre 8 y 15 dígitos.';
  const email = d.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Revisa el correo; debe verse como nombre@dominio.com.';
  const [price, priceError] = money(d.pricePerCredit, 'el precio por crédito');
  if (priceError) errors.pricePerCredit = priceError;
  return ok(errors, () => ({ name, phone, email, pricePerCredit: price as Cents, notes: d.notes.trim() }));
}

/* ---------- Cuenta ---------- */

export interface AccountDraft {
  clientId: string;
  alias: string;
  username: string;
  plan: string;
  expiresAt: string;
  notes: string;
}

export interface AccountInput {
  clientId: string;
  alias: string;
  username: string;
  plan: string;
  expiresAt: ISODate | null;
  notes: string;
}

export function validateAccount(d: AccountDraft, data: AppData, editingId?: string): Validated<AccountInput, keyof AccountDraft> {
  const errors: FieldErrors<keyof AccountDraft> = {};
  if (!d.clientId) errors.clientId = 'Selecciona el cliente dueño de la cuenta.';
  const alias = d.alias.trim();
  if (!alias) errors.alias = 'Escribe un alias para reconocer la cuenta.';
  const username = d.username.trim();
  if (!username) errors.username = 'Escribe el usuario o identificador del portal.';
  else if (data.accounts.some((a) => a.id !== editingId && !a.archived && a.username.toLowerCase() === username.toLowerCase())) {
    errors.username = 'Ya existe otra cuenta con este usuario.';
  }
  if (d.expiresAt) {
    const e = date(d.expiresAt, 'la fecha de vencimiento');
    if (e) errors.expiresAt = e;
  }
  return ok(errors, () => ({
    clientId: d.clientId,
    alias,
    username,
    plan: d.plan.trim(),
    expiresAt: d.expiresAt || null,
    notes: d.notes.trim(),
  }));
}

/* ---------- Registrar servicio ---------- */

export const NEW_ACCOUNT = '__new__';

export interface ServiceDraft {
  clientId: string;
  accountId: string;
  newAlias: string;
  newUsername: string;
  newPlan: string;
  credits: string;
  unitPrice: string;
  amountPaid: string;
  method: PaymentMethod | '';
  notes: string;
  requestedOn: string;
}

export interface ServiceInput {
  clientId: string;
  accountId: string | null;
  newAccount: { alias: string; username: string; plan: string } | null;
  credits: number;
  unitPrice: Cents;
  amountPaid: Cents;
  method: PaymentMethod | null;
  notes: string;
  requestedOn: ISODate;
}

export function parseCredits(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

export function validateService(d: ServiceDraft, data: AppData): Validated<ServiceInput, keyof ServiceDraft> {
  const errors: FieldErrors<keyof ServiceDraft> = {};
  if (!d.clientId) errors.clientId = 'Selecciona un cliente.';
  const isNew = d.accountId === NEW_ACCOUNT;
  if (!d.accountId) errors.accountId = 'Selecciona la cuenta que recibirá los créditos.';
  if (isNew) {
    if (!d.newAlias.trim()) errors.newAlias = 'Escribe un alias para la nueva cuenta.';
    const u = d.newUsername.trim();
    if (!u) errors.newUsername = 'Escribe el usuario del portal.';
    else if (data.accounts.some((a) => !a.archived && a.username.toLowerCase() === u.toLowerCase())) {
      errors.newUsername = 'Ya existe una cuenta con este usuario.';
    }
  } else if (d.accountId && !data.accounts.some((a) => a.id === d.accountId && a.clientId === d.clientId)) {
    errors.accountId = 'La cuenta seleccionada no pertenece a este cliente.';
  }
  const credits = parseCredits(d.credits);
  if (d.credits.trim() === '') errors.credits = 'Escribe cuántos créditos solicitó.';
  else if (credits === null) errors.credits = 'Usa un número entero de créditos, por ejemplo 1, 2 o 6.';
  else if (credits < 1) errors.credits = 'Debe ser al menos 1 crédito.';
  else if (credits > 999) errors.credits = 'El máximo por operación es 999 créditos.';
  const [unitPrice, priceError] = money(d.unitPrice, 'el precio por crédito');
  if (priceError) errors.unitPrice = priceError;
  let amountPaid: Cents = 0;
  if (d.amountPaid.trim() !== '') {
    const [paid, paidError] = money(d.amountPaid, 'el importe pagado', { allowZero: true });
    if (paidError) errors.amountPaid = paidError;
    else amountPaid = paid as Cents;
  }
  const total = credits !== null && unitPrice !== null ? Math.round(credits * unitPrice) : null;
  if (!errors.amountPaid && total !== null && amountPaid > total) {
    errors.amountPaid = 'El importe pagado no puede superar el total. Registra el excedente como pago aparte.';
  }
  if (amountPaid > 0 && !d.method) errors.method = 'Selecciona cómo pagó el cliente.';
  const dErr = date(d.requestedOn, 'la fecha de solicitud');
  if (dErr) errors.requestedOn = dErr;
  return ok(errors, () => ({
    clientId: d.clientId,
    accountId: isNew ? null : d.accountId,
    newAccount: isNew ? { alias: d.newAlias.trim(), username: d.newUsername.trim(), plan: d.newPlan.trim() } : null,
    credits: credits as number,
    unitPrice: unitPrice as Cents,
    amountPaid,
    method: amountPaid > 0 ? (d.method as PaymentMethod) : null,
    notes: d.notes.trim(),
    requestedOn: d.requestedOn,
  }));
}

/* ---------- Confirmar asignación ---------- */

export interface AssignmentDraft {
  assignedOn: string;
  portalExpiresAt: string;
  confirmedBy: string;
  note: string;
}

export interface AssignmentInput {
  assignedOn: ISODate;
  portalExpiresAt: ISODate;
  confirmedBy: string;
  note: string;
}

export function validateAssignment(d: AssignmentDraft, today: ISODate): Validated<AssignmentInput, keyof AssignmentDraft> {
  const errors: FieldErrors<keyof AssignmentDraft> = {};
  const a = date(d.assignedOn, 'la fecha de asignación');
  if (a) errors.assignedOn = a;
  else if (d.assignedOn > today) errors.assignedOn = 'La fecha de asignación no puede ser futura.';
  const e = date(d.portalExpiresAt, 'el vencimiento que muestra el portal');
  if (e) errors.portalExpiresAt = e;
  else if (!a && d.portalExpiresAt < d.assignedOn) {
    errors.portalExpiresAt = 'El vencimiento no puede ser anterior a la fecha de asignación.';
  }
  if (!d.confirmedBy.trim()) errors.confirmedBy = 'Escribe quién realizó la asignación.';
  return ok(errors, () => ({
    assignedOn: d.assignedOn,
    portalExpiresAt: d.portalExpiresAt,
    confirmedBy: d.confirmedBy.trim(),
    note: d.note.trim(),
  }));
}

/* ---------- Registrar pago ---------- */

export interface PaymentDraft {
  clientId: string;
  amount: string;
  method: PaymentMethod | '';
  date: string;
  reference: string;
  target: 'general' | 'charges';
  chargeIds: string[];
}

export interface PaymentInput {
  clientId: string;
  amount: Cents;
  method: PaymentMethod;
  date: ISODate;
  reference: string;
  chargeIds: string[];
}

export function validatePayment(d: PaymentDraft, data: AppData): Validated<PaymentInput, keyof PaymentDraft> {
  const errors: FieldErrors<keyof PaymentDraft> = {};
  if (!d.clientId) errors.clientId = 'Selecciona el cliente que pagó.';
  const [amount, amountError] = money(d.amount, 'el importe');
  if (amountError) errors.amount = amountError;
  if (!d.method) errors.method = 'Selecciona el método de pago.';
  const dErr = date(d.date, 'la fecha del pago');
  if (dErr) errors.date = dErr;
  if (d.target === 'charges') {
    if (d.chargeIds.length === 0) errors.chargeIds = 'Selecciona al menos un cargo o aplica el pago al saldo general.';
    else if (amount !== null && d.clientId) {
      const selected = openCharges(data, d.clientId).filter((c) => d.chargeIds.includes(c.chargeId));
      const pending = selected.reduce((acc, c) => acc + c.outstanding, 0);
      if (amount > pending) {
        errors.amount = 'El importe supera lo pendiente de los cargos seleccionados. Selecciona más cargos o aplícalo al saldo general.';
      }
    }
  }
  return ok(errors, () => ({
    clientId: d.clientId,
    amount: amount as Cents,
    method: d.method as PaymentMethod,
    date: d.date,
    reference: d.reference.trim(),
    chargeIds: d.target === 'charges' ? d.chargeIds : [],
  }));
}

/* ---------- Ajuste ---------- */

export interface AdjustmentDraft {
  direction: 'increase' | 'decrease';
  amount: string;
  date: string;
  note: string;
}

export interface AdjustmentInput {
  amount: Cents;
  date: ISODate;
  note: string;
}

export function validateAdjustment(d: AdjustmentDraft): Validated<AdjustmentInput, keyof AdjustmentDraft> {
  const errors: FieldErrors<keyof AdjustmentDraft> = {};
  const [amount, amountError] = money(d.amount, 'el importe del ajuste');
  if (amountError) errors.amount = amountError;
  const dErr = date(d.date, 'la fecha del ajuste');
  if (dErr) errors.date = dErr;
  if (!d.note.trim()) errors.note = 'Explica el motivo del ajuste para conservar el historial claro.';
  return ok(errors, () => ({
    amount: d.direction === 'increase' ? (amount as Cents) : -(amount as Cents),
    date: d.date,
    note: d.note.trim(),
  }));
}
