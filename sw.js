const CACHE = 'tarot-v3';

// All local assets to pre-cache on install
const LOCAL_IMAGES = [
  'RWS_Tarot_00_Fool.jpg',
  'RWS_Tarot_01_Magician.jpg',
  'RWS_Tarot_02_High_Priestess.jpg',
  'RWS_Tarot_03_Empress.jpg',
  'RWS_Tarot_04_Emperor.jpg',
  'RWS_Tarot_05_Hierophant.jpg',
  'RWS_Tarot_06_Lovers.jpg',
  'RWS_Tarot_07_Chariot.jpg',
  'RWS_Tarot_08_Strength.jpg',
  'RWS_Tarot_09_Hermit.jpg',
  'RWS_Tarot_10_Wheel_of_Fortune.jpg',
  'RWS_Tarot_11_Justice.jpg',
  'RWS_Tarot_12_Hanged_Man.jpg',
  'RWS_Tarot_13_Death.jpg',
  'RWS_Tarot_14_Temperance.jpg',
  'RWS_Tarot_15_Devil.jpg',
  'RWS_Tarot_16_Tower.jpg',
  'RWS_Tarot_17_Star.jpg',
  'RWS_Tarot_18_Moon.jpg',
  'RWS_Tarot_19_Sun.jpg',
  'RWS_Tarot_20_Judgement.jpg',
  'RWS_Tarot_21_World.jpg',
  'Wands01.jpg', 'Wands02.jpg', 'Wands03.jpg', 'Wands04.jpg',
  'Wands05.jpg', 'Wands06.jpg', 'Wands07.jpg', 'Wands08.jpg',
  'Tarot_Nine_of_Wands.jpg', 'Wands10.jpg', 'Wands11.jpg',
  'Wands12.jpg', 'Wands13.jpg', 'Wands14.jpg',
  'Cups01.jpg', 'Cups02.jpg', 'Cups03.jpg', 'Cups04.jpg',
  'Cups05.jpg', 'Cups06.jpg', 'Cups07.jpg', 'Cups08.jpg',
  'Cups09.jpg', 'Cups10.jpg', 'Cups11.jpg', 'Cups12.jpg',
  'Cups13.jpg', 'Cups14.jpg',
  'Swords01.jpg', 'Swords02.jpg', 'Swords03.jpg', 'Swords04.jpg',
  'Swords05.jpg', 'Swords06.jpg', 'Swords07.jpg', 'Swords08.jpg',
  'Swords09.jpg', 'Swords10.jpg', 'Swords11.jpg', 'Swords12.jpg',
  'Swords13.jpg', 'Swords14.jpg',
  'Pents01.jpg', 'Pents02.jpg', 'Pents03.jpg', 'Pents04.jpg',
  'Pents05.jpg', 'Pents06.jpg', 'Pents07.jpg', 'Pents08.jpg',
  'Pents09.jpg', 'Pents10.jpg', 'Pents11.jpg', 'Pents12.jpg',
  'Pents13.jpg', 'Pents14.jpg',
].map(f => `./assets/images/${f}`);

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/fonts/fonts.css',
  ...LOCAL_IMAGES,
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache =>
        // addAll for guaranteed app shell; allSettled for optional assets (fonts/images)
        // that may not exist yet if download-assets.js hasn't been run
        Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Cache-first for everything same-origin (app shell + local assets)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        }).catch(() =>
          e.request.mode === 'navigate'
            ? caches.match('./index.html')
            : new Response('Offline', { status: 503 })
        );
      })
    );
    return;
  }

  // Network-first with cache fallback for external CDN (Wikimedia, Google Fonts)
  // Only hit if local assets weren't bundled
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() =>
      caches.match(e.request).then(hit =>
        hit || new Response('', { status: 404 })
      )
    )
  );
});
