// Offline support. The page itself (index.html) is network-first, so a fresh version always
// opens when there is internet: an old cached page must never run next to a new one
// (with the shared budget, an outdated copy of the app could otherwise overwrite fresh data).
// Other files: cache first, refreshed in the background. Exchange rates and the sync server
// (other origins) always go to the network.
// Bump VERSION when files change so phones pick up the new version on the next launch.
const VERSION = 'scrmoney-v32';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  '../lora_regular.woff', '../lora_medium.woff', '../lora_italic.woff', '../lora_medium_italic.woff'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('scrmoney-') && k !== VERSION) /* only this app's own caches: the apps share one site */.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const page = e.request.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      if (page) {
        try {
          const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 5000);
          const res = await fetch(e.request, { cache: 'no-store', signal: ctl.signal });
          clearTimeout(timer);
          if (res.ok) { cache.put(e.request, res.clone()); return res; }
        } catch (err) {}
        return (await cache.match(e.request, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
      }
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
