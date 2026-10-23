'use client';

import { useEffect } from 'react';

/** Registers the (cache-free for private data) service worker in production builds. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Installability is a progressive enhancement; ignore registration failures.
    });
  }, []);
  return null;
}
