import 'server-only';

import { parseServerEnv, type ServerEnv } from './schema';

let cached: ServerEnv | undefined;

/** Validated server environment. Throws (without echoing values) if misconfigured. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
