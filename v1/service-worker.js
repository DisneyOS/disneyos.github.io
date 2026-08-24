const CACHE_NAME = "disneyos-v3.3.1";

const SHELL = [
  "./",
  "./index.html",
  "./wait-times-menu.html",
  "./wait-times.html",
  "./people-approval.html",
  "./managed-guest-approval.html",
  "./css/managed-guest-approval.css?v=3.3.1",
  "./js/managed-guest-approval.js?v=3.3.1",
  "./css/people-approval.css?v=3.2.0",
  "./js/people-approval.js?v=3.2.0",
  "./css/theme.css?v=2.0.9",
  "./css/styles.css?v=3.3.1",
  "./js/app.js?v=3.3.1",
  "./js/wait-times.js",
  "./assets/disneyos-logo-transparent.png",
  "./assets/disneyos-mark.png",
  "./assets/manifest-icon-192.png",
  "./assets/manifest-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // IMPORTANT: Never intercept external API requests. Weather, park-day,
  // planner, and other DisneyOS APIs must go directly to their network origin.
  if (url.origin !== self.location.origin) return;

  // This worker is installed under /v1/, so only manage the DisneyOS app shell.
  if (!url.pathname.startsWith("/v1/")) return;

  // Navigations are network-first so deployments are discovered quickly,
  // with the cached shell available as an offline fallback.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
            );
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Static app assets use stale-while-revalidate. Versioned URLs ensure a
  // changed app.js is fetched immediately when its version is bumped.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          );
        }
        return response;
      });

      return cached || network;
    })
  );
});
