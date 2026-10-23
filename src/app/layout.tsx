import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
import { getRequestLocale } from '@/lib/i18n/server';

import { jakarta } from './fonts';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'OVYRA', template: '%s · OVYRA' },
  description: 'Private email productivity app.',
  applicationName: 'OVYRA',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: 'OVYRA', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f9ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1025' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  return (
    <html lang={locale} className={jakarta.variable}>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
