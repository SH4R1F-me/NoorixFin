self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || 'NoorixFin';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'You have a new notification.',
      tag: payload.notificationId || undefined,
      data: { actionUrl: payload.actionUrl || '/dashboard/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.actionUrl || '/dashboard/notifications',
    self.location.origin,
  ).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return clients.openWindow(target);
    }),
  );
});
