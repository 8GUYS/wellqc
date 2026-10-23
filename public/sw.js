const CACHE_NAME = "wellqc-pwa-v2";

const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/fonts/SFPRODISPLAYREGULAR.woff",
  "/fonts/SFPRODISPLAYMEDIUM.woff",
  "/fonts/SFPRODISPLAYBOLD.woff",
  "/brand/wellqc-icon.svg",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/brand/wellqc-logo-full-light.png",
  "/brand/wellqc-logo-full-transparent.png",
];

// Install: Cache core offline shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn("[WellQC SW] Precache partial error (non-fatal):", err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy router
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Bypass localhost & local development entirely
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // Bypass Next.js chunks & hot reload assets
  if (url.pathname.startsWith("/_next/")) {
    return;
  }

  // Bypass API calls — live data should not be served stale
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 1. Navigation requests (HTML pages): Network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          // If offline, check if page is cached, else serve /offline fallback
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match("/offline");
          if (offlinePage) return offlinePage;
          return new Response("Offline - WellQC Workstation requires an active connection.", {
            headers: { "Content-Type": "text/html" },
          });
        })
    );
    return;
  }

  // 2. Static Assets (fonts, brand images, icons, _next static files): Cache-first
  const isStatic =
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff|woff2|ico|css|js)$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Default: Stale-while-revalidate for other assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Message listener (for skipWaiting updates)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
