import type postgres from 'postgres';

/**
 * Append-only security audit trail (audit.events).
 *
 * Metadata is restricted to an allowlist of keys with short primitive values
 * so that credentials, email addresses or message content cannot end up in
 * the audit log, even by mistake.
 */

export const AUDIT_EVENT_TYPES = [
  'auth.sign_in',
  'auth.sign_in_denied',
  'auth.sign_out',
  'auth.sign_out_everywhere',
  'settings.locale_changed',
  'settings.profile_updated',
  'security.ownership_violation',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

const METADATA_KEYS = ['locale', 'scope', 'reason', 'provider', 'fields', 'route'] as const;
type MetadataKey = (typeof METADATA_KEYS)[number];
type MetadataValue = string | number | boolean | string[];
export type AuditMetadata = Partial<Record<MetadataKey, MetadataValue>>;

const SAFE_STRING = /^[A-Za-z0-9_.:/-]{0,64}$/;

export function sanitizeAuditMetadata(input: Record<string, unknown> | undefined): AuditMetadata {
  const output: AuditMetadata = {};
  if (!input) return output;
  for (const key of METADATA_KEYS) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean') output[key] = value;
    else if (typeof value === 'string' && SAFE_STRING.test(value)) output[key] = value;
    else if (Array.isArray(value)) {
      const items = value.filter(
        (item): item is string => typeof item === 'string' && SAFE_STRING.test(item),
      );
      if (items.length > 0) output[key] = items.slice(0, 10);
    }
  }
  return output;
}

export interface AuditEventInput {
  userId: string | null;
  actor: 'user' | 'system';
  eventType: AuditEventType;
  targetType?: string;
  targetId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventRow {
  id: string;
  occurredAt: Date;
  eventType: string;
  metadata: AuditMetadata;
}

export async function recordAuditEvent(sql: postgres.Sql, event: AuditEventInput): Promise<void> {
  if (!AUDIT_EVENT_TYPES.includes(event.eventType)) {
    throw new Error('Unknown audit event type');
  }
  const metadata = sanitizeAuditMetadata(event.metadata);
  await sql`
    insert into audit.events (user_id, actor, event_type, target_type, target_id, request_id, metadata)
    values (
      ${event.userId},
      ${event.actor},
      ${event.eventType},
      ${event.targetType ?? null},
      ${event.targetId ?? null},
      ${event.requestId ?? null},
      ${sql.json(metadata)}
    )
  `;
}

export async function listAuditEventsForUser(
  sql: postgres.Sql,
  userId: string,
  limit = 20,
): Promise<AuditEventRow[]> {
  const rows = await sql<
    { id: string; occurred_at: Date; event_type: string; metadata: AuditMetadata }[]
  >`
    select id::text as id, occurred_at, event_type, metadata
    from audit.events
    where user_id = ${userId}
    order by occurred_at desc
    limit ${Math.min(Math.max(limit, 1), 100)}
  `;
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    eventType: row.event_type,
    metadata: row.metadata,
  }));
}
