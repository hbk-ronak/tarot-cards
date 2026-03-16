// Tarot PWA Service Worker
// Increment CACHE version to bust cache after updates
const CACHE = 'tarot-v2';

// Core app shell files to pre-cache on install
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Attempt to pre-cache local card images and fonts if they exist
// (populated by download-assets.js — ignored if files aren't present)
const LOCAL_ASSETS = [
  './assets/fonts/cormorant-garamond.css',
  // Card images are discovered dynamically at runtime and cached on first use
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Pre-cache app shell; ignore failures for optional local assets
      return cache.addAll(APP_SHELL).then(() =>
        Promise.allSettled(LOCAL_ASSETS.map(url => cache.add(url)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Strategy: cache-first for local assets (app shell, local images, local fonts)
  // Strategy: network-first with cache fallback for remote CDN (Wikimedia, Google Fonts)
  const isRemoteCDN = url.hostname === 'upload.wikimedia.org';

  // When local font assets exist, redirect Google Fonts requests to local copies
  const isGoogleFonts = url.hostname === 'fonts.googleapis.com' ||
                        url.hostname === 'fonts.gstatic.com';
  if (isGoogleFonts) {
    e.respondWith(
      caches.match('./assets/fonts/fonts.css').then(localFonts => {
        if (localFonts && url.hostname === 'fonts.googleapis.com') {
          return localFonts;
        }
        // For gstatic font files, try cache first then network
        return caches.match(e.request).then(hit => hit ||
          fetch(e.request).then(res => {
            if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
            return res;
          }).catch(() => new Response('', { status: 404 }))
        );
      })
    );
    return;
  }

  if (isRemoteCDN) {
    // Network-first: try to fetch fresh, cache the result, fall back to cache
    e.respondWith(
      caches.open(CACHE).then(cache =>
        fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() =>
          cache.match(e.request).then(hit =>
            hit || new Response('', { status: 404 })
          )
        )
      )
    );
  } else {
    // Cache-first: serve from cache instantly, fall back to network
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          // Cache successful responses for future offline use
          if (res.ok) {
            caches.open(CACHE).then(cache => cache.put(e.request, res.clone()));
          }
          return res;
        }).catch(() =>
          // Last resort: return the cached index for navigation requests
          e.request.mode === 'navigate'
            ? caches.match('./index.html')
            : new Response('Offline', { status: 503 })
        )
      )
    );
  }
});
