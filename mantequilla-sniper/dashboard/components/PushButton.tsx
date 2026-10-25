'use client';

import { useEffect, useState } from 'react';
import { savePushSubscription } from '@/app/actions';

function b64ToUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushButton({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<'idle' | 'on' | 'unsupported' | 'denied' | 'error' | 'working'>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidKey) return setState('unsupported');
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      if (await reg.pushManager.getSubscription()) setState('on');
    });
  }, [vapidKey]);

  async function enable() {
    setState('working');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(vapidKey) as BufferSource });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await savePushSubscription({ endpoint: json.endpoint, keys: json.keys });
      setState('on');
    } catch {
      setState('error');
    }
  }

  if (state === 'unsupported') return <p className="sub">Este navegador no admite notificaciones push (en iPhone, agrega el dashboard a la pantalla de inicio) o falta la llave VAPID.</p>;
  if (state === 'on') return <span className="pill ok"><span className="dot" />Push activado en este dispositivo</span>;
  return (
    <>
      <button className="primary" onClick={enable} disabled={state === 'working'}>Activar notificaciones push</button>
      {state === 'denied' && <p className="sub">Permiso denegado en el navegador.</p>}
      {state === 'error' && <p className="sub">No se pudo activar; intenta de nuevo.</p>}
    </>
  );
}
