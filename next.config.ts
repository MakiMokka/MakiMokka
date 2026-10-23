import type { NextConfig } from 'next';

import packageJson from './package.json' with { type: 'json' };
import { assertNoPublicSecretLeaks } from './src/lib/security/public-env-guard';
import { buildSecurityHeaders } from './src/lib/security/headers';

// Fail the build if a secret was put in a NEXT_PUBLIC_* variable.
assertNoPublicSecretLeaks(process.env);

const isProduction = process.env.NODE_ENV === 'production';
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);

const nextConfig: NextConfig = {
  // Cache Components / Partial Prerendering are intentionally NOT enabled:
  // every page is private, rendered per request and protected by a
  // nonce-based CSP, which prerendered shells cannot carry.
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_APP_COMMIT: commit,
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      { source: '/:path*', headers: buildSecurityHeaders(isProduction) },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
