const CACHE_VERSION = "deutschkarte-v19";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./theme-init.js",
  "./boot-guard.js",
  "./app.js",
  "./ai-tutor.js",
  "./sync.js",
  "./manifest.json",
  "./data/index.js",
  "./data/lesson_01.js",
  "./data/lesson_02.js",
  "./data/grammar.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" }))
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Runtime cache for Google Fonts (stale-while-revalidate)
  if (
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached || Response.error());
        return cached || networkPromise;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first with coherent cache fallback for all local app assets
  // Keeps HTML, CSS, JS, and lesson modules 100% version-synced while online,
  // and serves the precached bundle cleanly while offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) {
          return cached;
        }
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      })
  );
});
