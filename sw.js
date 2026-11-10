// Hourbox service worker: only used to show notifications and handle their buttons.
// It does not cache pages or intercept any requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const d = e.notification.data || {};
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = wins[0];
    if (e.action === "done" && d.date && d.key) {
      if (win) win.postMessage({ type: "hourbox-mark-done", date: d.date, key: d.key });
      return; // marking done doesn't need to open the app
    }
    if (win) return win.focus();
    return self.clients.openWindow("./");
  })());
});
