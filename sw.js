// Hourbox service worker: shows notifications and handles their buttons, and makes sure the app's own
// files are always the latest version. It stores nothing: each file is checked with the server
// (a quick "not changed" answer when it hasn't), so a new version never mixes with old cached files.
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
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return; // Firebase, Google and fonts go straight through
  e.respondWith(fetch(u.href, { cache: "no-cache", credentials: "same-origin" }).catch(() => fetch(r)));
});
