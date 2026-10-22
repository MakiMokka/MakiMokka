import {
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CircleAlert,
  CircleCheck,
  CircleDollarSign,
  Clock,
  Hourglass,
  Info,
  type LucideIcon,
} from 'lucide-react';
import type { ExpiryKind, PaymentState, StatusDescriptor, Tone, Emphasis } from '../domain/status';
import { assignmentDescriptor, paymentStateDescriptor } from '../domain/status';
import type { AssignmentStatus } from '../domain/types';

interface BadgeProps {
  tone: Tone;
  emphasis?: Emphasis;
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md';
}

/** Estado visual: siempre color + icono + texto. */
export function StatusBadge({ tone, emphasis = 'soft', icon: Icon, label, size = 'md' }: BadgeProps) {
  return (
    <span className={`badge badge--${tone} badge--${emphasis} badge--${size}`}>
      <Icon size={size === 'sm' ? 14 : 15} aria-hidden />
      <span>{label}</span>
    </span>
  );
}

const expiryIcons: Record<ExpiryKind, LucideIcon> = {
  none: Info,
  expired: CalendarX,
  today: CircleAlert,
  critical: CalendarClock,
  soon: CalendarClock,
  ok: CalendarCheck,
};

export function ExpiryBadge({ status, size }: { status: { kind: ExpiryKind } & StatusDescriptor; size?: 'sm' | 'md' }) {
  return <StatusBadge tone={status.tone} emphasis={status.emphasis} icon={expiryIcons[status.kind]} label={status.label} size={size} />;
}

const assignmentIcons: Record<AssignmentStatus, LucideIcon> = {
  pending: Hourglass,
  assigned: CircleCheck,
  cancelled: Ban,
};

export function AssignmentBadge({ status, size, label }: { status: AssignmentStatus; size?: 'sm' | 'md'; label?: string }) {
  const d = assignmentDescriptor[status];
  return <StatusBadge tone={d.tone} emphasis={d.emphasis} icon={assignmentIcons[status]} label={label ?? d.label} size={size} />;
}

const paymentIcons: Record<PaymentState, LucideIcon> = {
  pending: Clock,
  partial: CircleDollarSign,
  paid: CircleCheck,
  credit: Info,
};

export function PaymentBadge({ state, size }: { state: PaymentState; size?: 'sm' | 'md' }) {
  const d = paymentStateDescriptor[state];
  return <StatusBadge tone={d.tone} emphasis={d.emphasis} icon={paymentIcons[state]} label={d.label} size={size} />;
}
