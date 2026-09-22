const CACHE_NAME = "disneyos-v3.12.2";

const SHELL = [
  "./js/genie.mjs?v=1",
  "./css/genie.css?v=1",
  "./js/notifications.mjs?v=1",
  "./css/notifications.css?v=1",
  "./",
  "./index.html",
  "./js/alerts.mjs?v=3",
  "./css/alerts.css?v=1",
  "./lightning-lanes.html",
  "./css/lightning-lanes.css?v=7d.3",
  "./js/lightning-lanes.mjs?v=7d.3",
  "./wait-times-menu.html",
  "./wait-times.html",
  "./people-approval.html",
  "./managed-guest-approval.html",
  "./css/managed-guest-approval.css?v=3.3.1",
  "./js/managed-guest-approval.js?v=3.3.1",
  "./css/people-approval.css?v=3.2.0",
  "./js/people-approval.js?v=3.2.0",
  "./css/theme.css?v=2.0.9",
  "./css/styles.css?v=3.5.1",
  "./js/app.js?v=3.11.1",
  "./css/my-trip.css?v=1",
  "./js/my-trip.mjs?v=4",
  "./js/trip-model.mjs",
  "./js/home-model.mjs",
  "./css/home.css?v=1",
  "./css/parks.css?v=2",
  "./js/parks.mjs?v=4",
  "./js/parks-model.mjs",
  "./js/wait-times.js?v=3.8.0",
  "./assets/disneyos-logo-transparent.png",
  "./assets/genie-lamp.svg",
  "./assets/disneyos-mark.png",
  "./assets/manifest-icon-192.png",
  "./assets/manifest-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL.map(path =>
        new Request(new URL(path, self.location.href), { cache: "reload" })
      )))
      .then(() => self.skipWaiting())
  );
});

function notificationURL(value) {
  try {
    const url=new URL(value,self.location.origin);
    if(url.origin===self.location.origin && url.pathname==='/v1/' && ['alerts','trip','settings'].includes(url.searchParams.get('view')))return url.href;
    const workflow=url.searchParams.get('workflow');
    if(url.origin===self.location.origin && url.pathname==='/v1/lightning-lanes.html' && url.searchParams.size===1 && /^workflow_[A-Za-z0-9-]{8,160}$/.test(workflow||''))return new URL('/v1/lightning-lanes.html?workflow='+encodeURIComponent(workflow),self.location.origin).href;
  }catch{}
  return new URL('/v1/',self.location.origin).href;
}
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let payload={};try{payload=event.data?.json()||{};}catch{}
    if(!payload||typeof payload!=='object')payload={};
    await self.registration.showNotification(typeof payload.title==='string'?payload.title.slice(0,140):'DisneyOS',{
      body:typeof payload.body==='string'?payload.body.slice(0,220):'Open DisneyOS to see the latest update.',
      icon:'/v1/assets/manifest-icon-192.png',tag:typeof payload.tag==='string'?payload.tag:undefined,
      data:{url:notificationURL(payload.url)},actions:[{action:'view',title:payload.actionRequired?'Review in DisneyOS':'View in DisneyOS'}]
    });
    if(Number.isInteger(payload.badge)&&payload.badge>=0&&'setAppBadge' in self.navigator){
      try{if(payload.badge)await self.navigator.setAppBadge(payload.badge);else await self.navigator.clearAppBadge();}catch{}
    }
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=notificationURL(event.notification.data?.url);
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=clients.find(c=>{const u=new URL(c.url);return u.origin===self.location.origin&&u.pathname.startsWith('/v1/');});
    if(client){try{const navigated=await client.navigate(url);if(navigated){await navigated.focus();return;}}catch{}}
    await self.clients.openWindow(url);
  })());
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
      fetch(event.request, { cache: "no-store" })
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
