'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Estado' },
  { href: '/activity', label: 'Actividad' },
  { href: '/settings', label: 'Configuración' },
];

export function Tabs() {
  const path = usePathname();
  if (path === '/login') return null;
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
