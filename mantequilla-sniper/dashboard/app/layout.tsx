import type { Metadata, Viewport } from 'next';
import { Tabs } from '@/components/Tabs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mantequilla Sniper',
  description: 'Estado del robot de reservaciones de Mantequilla Social Club',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#c98a00' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        <Tabs />
        {children}
      </body>
    </html>
  );
}
