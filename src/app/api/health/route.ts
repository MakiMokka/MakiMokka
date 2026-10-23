import { jsonResponse, methodNotAllowed, withApiHandler } from '@/lib/api/response';
import { APP_VERSION } from '@/lib/version';

/** Liveness only. Reveals no configuration, dependencies or user data. */
export const GET = withApiHandler(async () => jsonResponse({ status: 'ok', version: APP_VERSION }));

export const POST = methodNotAllowed(['GET']);
