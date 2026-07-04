/**
 * sw.js — Service Worker
 * ------------------------------------------------------------------
 * Strategy: cache-first for the app shell, so Daymark opens instantly
 * and works offline once installed. Bump CACHE_VERSION whenever any
 * cached file changes — this is what forces the browser to fetch
 * fresh copies instead of serving stale ones from cache.
 */

const CACHE_VERSION = "daymark-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/storage.js",
  "./js/notifications.js",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
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
  // Only handle GET requests for our own origin; let everything else
  // (e.g. the Google Fonts CDN) pass through to the network normally.
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache successful same-origin responses for next time.
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached — fall back to the shell for navigations.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
