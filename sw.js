// SmartFix HMS - Offline Cache & PWA Service Worker
const CACHE_NAME = "smartfix-hms-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/firebase-config.js",
  "./js/auth.js",
  "./js/license.js",
  "./js/bookings.js",
  "./js/tape-chart.js",
  "./js/pos.js",
  "./js/thermal-print.js"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Strategy: Network First with Cache Fallback
self.addEventListener("fetch", (event) => {
  // Ignore non-GET requests or firebase real-time streaming
  if (event.request.method !== "GET" || event.request.url.includes("firestore.googleapis.com")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => caches.match(event.request))
  );
});
