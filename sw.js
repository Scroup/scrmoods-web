// Offline support. The page itself (index.html) comes from the network first, so a new version shows up the next
// time the app opens with internet; the cached copy is used when offline. Fonts and icons come from the cache first.
// Bump VERSION (and APP_VERSION in index.html) when files change.
// Only caches, never your data: the journal lives in localStorage / IndexedDB, which this file doesn't touch.
const VERSION = 'scrmoods-v33';
const PREFIX = 'scrmoods-'; // the other apps on this site (scrcook, scrmoney…) keep their own caches: never delete theirs
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  './lora_regular.woff', './lora_medium.woff', './lora_italic.woff', './lora_medium_italic.woff'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only the app's own files and the styles' Google Fonts are cached; anything else goes to the network untouched.
const CACHEABLE = url => url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

/* The page: network first (up to 4 s), else the cached copy. */
function pageFirst(req) {
  return caches.open(VERSION).then(async cache => {
    const cached = () => cache.match('./index.html').then(r => r || cache.match(req, { ignoreSearch: true })); // the freshest copy first
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-store' }),
        new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000)),
      ]);
      if (res.ok) { cache.put('./index.html', res.clone()); return res; }
      return (await cached()) || res;
    } catch (err) {
      return (await cached()) || Response.error();
    }
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!CACHEABLE(url)) return;
  // "Check for updates" asks for sw.js?fresh=… : always straight from the network
  if (url.searchParams.has('fresh')) return;
  // this app's page only (not the other apps in subfolders, which this worker's scope also covers)
  const scope = new URL(self.registration.scope);
  const isPage = url.origin === scope.origin && (url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html');
  if (isPage) { e.respondWith(pageFirst(req)); return; }
  // anything else in another app's folder: leave it alone
  if (url.origin === scope.origin && /\/(scrcook|scrmoney|scrfitness)\//.test(url.pathname)) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
