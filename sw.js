// sw.js - SmartFix HMS Service Worker
// Strategy:
//   - HTML navigations: network-first, fallback to cached index.html
//   - App assets (JS/CSS/manifest): cache-first, refresh in background
//   - Firebase / Google / CDN calls: never cached (bypass to network)
//   - Anything else: try network, fallback to cache

const CACHE_VERSION = "v4";
const CACHE_NAME = `smartfix-hms-${CACHE_VERSION}`;

// Only same-origin app files we control. Missing files won't break install
// thanks to Promise.allSettled().
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./super-admin.html",
  "./manifest.json",
  "./js/firebase-config.js",
  "./js/auth.js",
  "./js/license.js",
  "./js/bookings.js",
  "./js/tape-chart.js",
  "./js/pos.js",
  "./js/thermal-print.js"
];

// ---------- Hosts that must NEVER be cached ----------
const BYPASS_HOSTS = [
  "firebaseio.com",
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebaseapp.com",
  "googleapis.com",
  "gstatic.com",
  "cdn.tailwindcss.com",
  "cdnjs.cloudflare.com",
  "jsdelivr.net",
  "unpkg.com"
];

function shouldBypass(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    if (u.origin !== self.location.origin) {
      // Cross-origin: bypass Firebase/CDN, but allow same-app subdomains if any
      return BYPASS_HOSTS.some(h => u.hostname.includes(h)) || true;
    }
    return false;
  } catch (_) {
    return true;
  }
}

// ---------- INSTALL ----------
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // BUG FIX #22: allSettled → one failed asset does NOT kill install
    const results = await Promise.allSettled(
      PRECACHE_ASSETS.map(url =>
        cache.add(url).catch(err => {
          console.warn(`[SW] Precaching failed for ${url}:`, err.message);
          throw err;
        })
      )
    );
    const failed = results.filter(r => r.status === "rejected").length;
    console.log(`[SW] Precache complete: ${PRECACHE_ASSETS.length - failed}/${PRECACHE_ASSETS.length} OK`);
    // Activate this SW immediately
    self.skipWaiting();
  })());
});

// ---------- ACTIVATE ----------
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Clean up caches from previous versions
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith("smartfix-hms-") && k !== CACHE_NAME)
        .map(k => {
          console.log(`[SW] Deleting old cache: ${k}`);
          return caches.delete(k);
        })
    );
    // Take control of all open tabs
    await self.clients.claim();
  })());
});

// ---------- MESSAGE (manual refresh trigger from client) ----------
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});

// ---------- FETCH ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1. Only handle GET
  if (req.method !== "GET") return;

  // 2. Bypass cross-origin / API endpoints — always go to network
  if (shouldBypass(req.url)) return;

  const url = new URL(req.url);
  const isHTML = req.mode === "navigate" ||
                 (req.headers.get("accept") || "").includes("text/html");

  // 3. HTML navigations: network-first with cache fallback
  if (isHTML) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  // 4. App assets: cache-first, refresh in background
  event.respondWith(cacheFirstAsset(req));
});

// ---------- Strategy 1: Network-first (HTML) ----------
async function networkFirstHTML(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkRes = await fetch(req);
    // Only cache successful HTML responses
    if (networkRes && networkRes.ok) {
      cache.put(req, networkRes.clone()).catch(() => {});
    }
    return networkRes;
  } catch (err) {
    // Offline → try exact request, then fallback to index.html
    const cached = await cache.match(req);
    if (cached) return cached;
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    // Last resort: empty offline page
    return new Response(
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;text-align:center;background:#060913;color:#fff;">
        <h1>You're offline</h1>
        <p>Please check your internet connection and reload.</p>
        <button onclick="location.reload()" style="margin-top:1rem;padding:0.6rem 1.2rem;background:#00f2fe;border:none;border-radius:8px;font-weight:bold;">Retry</button>
      </body></html>`,
      { status: 503, headers: { "Content-Type": "text/html" } }
    );
  }
}

// ---------- Strategy 2: Cache-first (assets) ----------
async function cacheFirstAsset(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) {
    // Background refresh (stale-while-revalidate)
    fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    }).catch(() => {});
    return cached;
  }

  // Not in cache → fetch and cache
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    // Asset not in cache + offline → return a minimal error
    if (req.destination === "script") {
      return new Response("// offline — asset unavailable", {
        headers: { "Content-Type": "application/javascript" }
      });
    }
    return new Response("", { status: 504 });
  }
}
