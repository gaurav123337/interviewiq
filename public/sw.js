/* InterviewIQ — service worker (Vite build): stale-while-revalidate.
   Hashed build assets get stale-while-revalidate (serve cached instantly,
   update in background); navigations are network-first so app updates land,
   with cached shell offline fallback. */

const CACHE = "interviewiq-v18";
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Cache shell files — tolerate individual failures
      for (const url of SHELL) {
        try { await cache.add(url); } catch { /* skip missing */ }
      }
      // Pre-cache all linked JS/CSS from index.html
      try {
        const res = await fetch("./index.html", { cache: "no-cache" });
        const html = await res.text();
        const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]);
        await Promise.all(assets.map(a => cache.add(a).catch(() => {})));
      } catch { /* fetch failed, will work offline from cache */ }
      await self.skipWaiting();
    })()
  );
});

/* Notify all clients when a new version is waiting */
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/* Auto-reload clients when a new SW takes over */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }))
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
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
  if (url.origin !== location.origin) return; /* let browser handle external */

  /* navigations: network-first, fallback to cached shell for offline */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) return res;
        return caches.match("./index.html");
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  /* static assets (hashed JS/CSS): stale-while-revalidate */
  if (req.url.match(/\.(?:js|css|woff2?|png|jpg|svg|ico)$/)) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  /* other same-origin requests: network-first */
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
