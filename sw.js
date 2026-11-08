const CACHE_NAME = "smartfix-hms-v5";
const ASSETS_TO_CACHE = [
  "./", 
  "./index.html", 
  "./dashboard.html", 
  "./super-admin.html", 
  "./manifest.json",
  "./icon.svg",
  "./js/firebase-config.js", 
  "./js/auth.js", 
  "./js/license.js",
  "./js/bookings.js", 
  "./js/tape-chart.js", 
  "./js/pos.js", 
  "./js/thermal-print.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.url.includes("firestore.googleapis.com") || e.request.url.includes("firebase")) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(c => { c.put(e.request, resClone); });
        return res;
      })
      .catch(() => caches.match(e.request)) 
  );
});
