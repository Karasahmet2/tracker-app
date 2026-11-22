// =========================================================
// Offline support. Saves the app files on the phone.
// Raise VERSION by one in every update (and in js/version.js):
// that's what tells phones a new version exists.
// =========================================================
const VERSION = 'tracker-v5';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/ui.js',
  './js/db.js',
  './js/state.js',
  './js/water.js',
  './js/settings.js',
  './js/backup.js',
  './js/calendar.js',
  './js/themes.js',
  './js/running.js',
  './js/runcal.js',
  './js/version.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== VERSION + '-fonts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: from the saved copy first (works offline).
// Fonts and anything else: from the network, falling back to a saved copy.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
    );
    return;
  }

  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(VERSION + '-fonts').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try { const res = await fetch(req); c.put(req, res.clone()); return res; }
        catch (e) { return hit || Response.error(); }
      })
    );
  }
});
