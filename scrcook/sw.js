// Offline support: serve the app from the cache, refresh the cache in the background.
// Bump VERSION when files change so phones pick up the new version on the next launch.
const VERSION = 'scrcook-v11';
const FILES = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png',
  './img/borsch.jpg', './img/cajun.jpg', './img/lavash.jpg', './img/omlet.jpg', './img/onigirazu.jpg', './img/pasta.jpg', './img/pirog.jpg', './img/potroast.jpg', './img/sendvich.jpg', './img/strips.jpg', './img/tabletki.jpg', './img/udon.jpg', './img/vafli.jpg', './img/vinegret.jpg',
  './img/w-pancakes.jpg', './img/w-frtoast.jpg', './img/w-syrniki.jpg', './img/w-shakshuka.jpg', './img/w-scramble.jpg', './img/w-chsoup.jpg', './img/w-lentil.jpg', './img/w-minestrone.jpg', './img/w-shawarma.jpg', './img/w-greek.jpg', './img/w-bolognese.jpg', './img/w-butterchicken.jpg', './img/w-stroganoff.jpg', './img/w-honeychicken.jpg', './img/w-chopsuey.jpg',
  './img/w-ramen.jpg', './img/peachtea.jpg', './img/lavkonv.jpg', './img/zapekanka.jpg', './img/kannelloni.jpg', './img/brie.jpg', './img/slivsup.jpg',
  '../lora_regular.woff', '../lora_medium.woff', '../lora_italic.woff', '../lora_medium_italic.woff'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Нажатие на уведомление таймера открывает приложение.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
