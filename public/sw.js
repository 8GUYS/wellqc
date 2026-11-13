/**
 * WellQC Workstation — Progressive Web App (PWA) Service Worker
 *
 * Cache Strategy:
 * - Cache Name: Bumped to wellqc-pwa-v3 to purge legacy stale RSC payloads.
 * - Cache ONLY static immutable assets (fonts, brand images, icons, _next/static).
 * - NEVER cache Next.js React Server Component (RSC) payloads (/_rsc=, headers).
 * - NEVER cache dynamic HTML page data (navigation requests fallback to /offline when offline).
 */

const CACHE_NAME = "wellqc-pwa-v3";

const PRECACHE_ASSETS = [
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

// Install: Cache offline fallback and core static assets
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

// Activate: Clean up all legacy cache versions & claim active clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("[WellQC SW] Purging obsolete cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy router
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Bypass non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // 2. Bypass localhost & local development entirely
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // 3. Bypass API endpoints — live subsurface telemetry should never be cached by SW
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 4. CRITICAL: Bypass Next.js React Server Component (RSC) payloads & server actions
  // RSC payloads contain deployment-specific client component IDs. Caching them across
  // deployments causes React error #130 ("Element type is invalid: expected string... got undefined").
  const isRscRequest =
    url.searchParams.has("_rsc") ||
    url.search.includes("_rsc=") ||
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    request.headers.has("Next-Url") ||
    request.headers.has("Next-Action");

  if (isRscRequest) {
    return;
  }

  // 5. Bypass internal Next.js server chunks & build manifests that are not static assets
  if (url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/")) {
    return;
  }

  // 6. Navigation requests (HTML pages): Network-first with offline fallback ONLY
  // Do NOT cache page HTML responses in SW cache to prevent serving stale client references.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match("/offline");
        if (offlinePage) return offlinePage;
        return new Response("Offline - WellQC Workstation requires an active connection.", {
          status: 503,
          headers: { "Content-Type": "text/html" },
        });
      })
    );
    return;
  }

  // 7. Static Assets (fonts, brand images, icons, _next/static immutable files): Cache-first
  const isStatic =
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
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

  // 8. Default: Allow all other dynamic requests to pass through to the network without caching
});

// Message listener (for skipWaiting updates)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
