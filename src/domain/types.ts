/**
 * Modelo de datos de la aplicación.
 *
 * Convenciones:
 * - Importes en centavos (enteros) para evitar errores de redondeo.
 * - Fechas de calendario como cadenas `YYYY-MM-DD` (sin zona horaria).
 * - Marcas de tiempo como ISO 8601 completas.
 */

export type ISODate = string;
export type ISODateTime = string;
export type Cents = number;

export interface PriceChange {
  price: Cents;
  changedAt: ISODateTime;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** Precio habitual vigente por crédito. Solo se usa para precargar nuevas operaciones. */
  pricePerCredit: Cents;
  priceHistory: PriceChange[];
  notes: string;
  archived: boolean;
  createdAt: ISODateTime;
}

export interface ExpiryChange {
  previous: ISODate | null;
  next: ISODate;
  serviceId: string | null;
  changedAt: ISODateTime;
  changedBy: string;
}

export interface Account {
  id: string;
  clientId: string;
  alias: string;
  /** Usuario o identificador de la cuenta en el portal de PopTV. */
  username: string;
  plan: string;
  /** Fecha de vencimiento capturada desde el portal (fuente de verdad). */
  expiresAt: ISODate | null;
  expiryHistory: ExpiryChange[];
  notes: string;
  archived: boolean;
  createdAt: ISODateTime;
}

export type AssignmentStatus = 'pending' | 'assigned' | 'cancelled';

export interface Assignment {
  status: AssignmentStatus;
  assignedOn?: ISODate;
  portalExpiresAt?: ISODate;
  previousExpiresAt?: ISODate | null;
  confirmedBy?: string;
  confirmedAt?: ISODateTime;
  note?: string;
  cancelledAt?: ISODateTime;
  cancelReason?: string;
}

/** Solicitud de créditos para una cuenta. Su asignación en el portal es manual. */
export interface Service {
  id: string;
  clientId: string;
  accountId: string;
  credits: number;
  /** Precio aplicado en esta operación; nunca se recalcula. */
  unitPrice: Cents;
  total: Cents;
  requestedOn: ISODate;
  notes: string;
  chargeId: string;
  assignment: Assignment;
  createdAt: ISODateTime;
}

export type MovementType = 'charge' | 'payment' | 'adjustment' | 'cancellation';

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'deposit' | 'other';

export interface Allocation {
  chargeId: string;
  amount: Cents;
}

export interface Movement {
  id: string;
  clientId: string;
  accountId: string | null;
  type: MovementType;
  date: ISODate;
  /**
   * Importe siempre positivo, salvo en ajustes, donde el signo indica
   * si aumenta (+) o reduce (−) el saldo del cliente.
   */
  amount: Cents;
  credits: number | null;
  unitPrice: Cents | null;
  serviceId: string | null;
  method: PaymentMethod | null;
  reference: string;
  note: string;
  /** Pagos aplicados a cargos específicos. Vacío = saldo general. */
  allocations: Allocation[];
  /** En cancelaciones, el cargo que anulan. */
  cancelsChargeId: string | null;
  createdAt: ISODateTime;
}

export interface Settings {
  operatorName: string;
}

export interface AppData {
  version: 1;
  clients: Client[];
  accounts: Account[];
  services: Service[];
  movements: Movement[];
  settings: Settings;
}

export const emptyData = (): AppData => ({
  version: 1,
  clients: [],
  accounts: [],
  services: [],
  movements: [],
  settings: { operatorName: '' },
});
