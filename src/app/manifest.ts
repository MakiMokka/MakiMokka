import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'OVYRA',
    short_name: 'OVYRA',
    description: 'Private email productivity app.',
    start_url: '/inbox',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8f9ff',
    theme_color: '#f8f9ff',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
