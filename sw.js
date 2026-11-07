const CACHE_NAME = "smartfix-v5";
const ASSETS = ["./", "./index.html", "./dashboard.html", "./manifest.json", "./js/firebase-config.js", "./js/auth.js", "./js/license.js", "./js/bookings.js", "./js/tape-chart.js", "./js/pos.js", "./js/thermal-print.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || e.request.url.includes("firestore.googleapis.com")) return;
  e.respondWith(fetch(e.request).then(res => {
    return caches.open(CACHE_NAME).then(c => { c.put(e.request, res.clone()); return res; });
  }).catch(() => caches.match(e.request)));
});
