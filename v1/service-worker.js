const CACHE_NAME = "disneyos-v1-shell-2.0";
const SHELL = [
  "./", "./index.html", "./wait-times-menu.html", "./wait-times.html",
  "./css/theme.css", "./css/styles.css", "./js/app.js", "./js/wait-times.js",
  "./assets/disneyos-logo-transparent.png", "./assets/disneyos-mark.png",
  "./assets/manifest-icon-192.png", "./assets/manifest-icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.includes("/v1/") && !url.pathname.includes("/api/")) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request)));
  }
});
