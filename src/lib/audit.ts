import 'server-only';

import { recordAuditEvent, type AuditEventInput } from '@/lib/db/repositories/audit';
import { getWorkerSql } from '@/lib/db/worker';
import { logger } from '@/lib/logging/logger';

/**
 * Best-effort audit write. A failure is logged (without details that could
 * contain data) but does not break the user's action.
 */
export async function audit(event: AuditEventInput): Promise<void> {
  const sql = getWorkerSql();
  if (!sql) {
    logger.warn('audit.unavailable', {
      eventType: event.eventType,
      reason: 'database_url_not_configured',
    });
    return;
  }
  try {
    await recordAuditEvent(sql, event);
  } catch (error) {
    logger.error('audit.write_failed', { eventType: event.eventType, error });
  }
}
