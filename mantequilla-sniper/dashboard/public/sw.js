// Service worker: muestra las notificaciones push del robot y abre el link al tocarlas.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Mantequilla Sniper', body: '' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.type,
      renotify: true,
      requireInteraction: Boolean(data.urgent),
      data: { url: data.url || '/' },
      icon: '/icon.svg',
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
