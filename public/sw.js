// Minimal service worker for "The Poster Said So"
// - Network-first for HTML navigations (no stale shell traps)
// - Cache-first for same-origin static assets
// - Skips Lovable preview hosts at registration time (see src/routes/__root.tsx)

const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== STATIC_CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigations → network first, fall back to cached index
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(STATIC_CACHE);
          cache.put("/", fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const cached = await cache.match("/");
          return cached || new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Static assets → cache first, populate on miss
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || new Response("Offline", { status: 503 });
      }
    })(),
  );
});
