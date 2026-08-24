/* InterviewIQ — service worker (Vite build): offline-first caching.
   Hashed build assets are immutable, so cache-first is safe for them;
   navigations are network-first so app updates land, with cached shell offline.
   The shell precaches index.html AND the hashed JS/CSS bundle it references,
   so the entire app — including the legal pages (Terms / Privacy / Refunds /
   Shipping) reachable from the footer on every view — works with no network. */

const CACHE = "interviewiq-v8";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      /* precache the hashed JS/CSS the current index.html references, so a
         fresh install is fully self-contained offline (legal views included) */
      .then(c =>
        fetch("./index.html", { cache: "no-cache" })
          .then(res => res.text())
          .then(html => {
            const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]);
            return Promise.all(assets.map(a => c.add(a).catch(() => {})));
          })
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Notify all clients when a new version is waiting */
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("updatefound", () => {
  const reg = self.registration;
  if (!reg.installing) return;
  reg.installing.addEventListener("statechange", () => {
    if (reg.installing.state === "installed" && navigator.serviceWorker.controller) {
      /* New SW installed but not yet active — notify clients */
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: "SW_UPDATE_READY" }));
      });
    }
  });
});

/* notification click: focus the app (or open it) on the practice screen */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; /* let browser handle external (e.g., AI API) */

  /* navigations: always network-first (needed for SPA routing redirects) */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  /* static assets: cache-first with runtime fill */
  e.respondWith(
    caches.match(req).then(hit =>
      hit ||
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
    )
  );
});
