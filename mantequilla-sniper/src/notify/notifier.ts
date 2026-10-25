import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { errorMessage, type Logger } from '../core/logger.js';
import { redact } from '../core/redact.js';
import { formatHumanDate } from '../core/time.js';
import type { Reservation } from '../core/types.js';
import type { EventType, Store } from '../store/types.js';

export interface Notification {
  type: EventType;
  title: string;
  body: string;
  /** Link para actuar (p. ej. la página de reservas cuando se requiere intervención humana). */
  url?: string;
  urgent?: boolean;
  data?: Record<string, unknown>;
}

export interface Channel {
  name: string;
  send(n: Notification): Promise<void>;
}

/**
 * Envía a todos los canales; un canal caído no bloquea a los demás.
 * El dashboard siempre recibe el evento (tabla events).
 */
export class Notifier {
  constructor(
    private readonly campaignId: string,
    private readonly store: Store,
    private readonly channels: Channel[],
    private readonly log: Logger,
  ) {}

  async notify(n: Notification): Promise<void> {
    try {
      await this.store.logEvent({ campaignId: this.campaignId, type: n.type, message: `${n.title} — ${n.body}`, data: n.data });
    } catch (err) {
      this.log.error('No se pudo guardar el evento del dashboard', { err: errorMessage(err) });
    }
    await Promise.all(
      this.channels.map(async (c) => {
        try {
          await c.send(n);
        } catch (err) {
          this.log.error('Fallo de canal de notificación', { channel: c.name, err: errorMessage(err) });
        }
      }),
    );
  }
}

export function successMessage(r: Reservation, timezone: string): Notification {
  const body = [
    'Reserva confirmada',
    '',
    `Nombre: ${r.guestName}`,
    `Fecha: ${formatHumanDate(r.date, timezone)}`,
    `Hora: ${r.time}`,
    `Personas: ${r.partySize}`,
    `Confirmación: ${r.confirmationId}`,
  ].join('\n');
  return {
    type: 'RESERVATION_CONFIRMED',
    title: r.restaurant.toUpperCase(),
    body,
    urgent: true,
    data: { date: r.date, time: r.time, confirmationId: r.confirmationId },
  };
}

export class EmailChannel implements Channel {
  name = 'email';
  private transport: nodemailer.Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
    private readonly to: string,
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }

  async send(n: Notification): Promise<void> {
    // El correo de éxito incluye el nombre de la reservación; los técnicos se ocultan.
    const body = n.type === 'RESERVATION_CONFIRMED' ? n.body : redact(n.body);
    await this.transport.sendMail({
      from: this.from,
      to: this.to,
      subject: `${n.urgent ? '🔴 ' : ''}${n.title}`,
      text: n.url ? `${body}\n\n${n.url}` : body,
    });
  }
}

export class WebPushChannel implements Channel {
  name = 'webpush';

  constructor(
    private readonly store: Store,
    vapid: { subject: string; publicKey: string; privateKey: string },
  ) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  }

  async send(n: Notification): Promise<void> {
    const subs = await this.store.listPushSubscriptions();
    const body = n.type === 'RESERVATION_CONFIRMED' ? n.body : redact(n.body);
    const payload = JSON.stringify({ title: n.title, body, url: n.url, urgent: n.urgent ?? false, type: n.type });
    await Promise.all(subs.map((s) => webpush.sendNotification(s, payload, { urgency: n.urgent ? 'high' : 'normal', TTL: 3600 })));
  }
}

export function channelsFromEnv(env: NodeJS.ProcessEnv, store: Store): Channel[] {
  const channels: Channel[] = [];
  if (env.SMTP_URL && env.NOTIFY_EMAIL_TO) {
    channels.push(new EmailChannel(env.SMTP_URL, env.NOTIFY_EMAIL_FROM ?? env.NOTIFY_EMAIL_TO, env.NOTIFY_EMAIL_TO));
  }
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    channels.push(
      new WebPushChannel(store, {
        subject: env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      }),
    );
  }
  return channels;
}
