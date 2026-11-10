
const CACHE = "parking-v2-ab5942b0f623808c";
const FILES = ["index.html","manifest.webmanifest","favicon.ico","assets/index-DVQTVjIy.css","assets/index-DsUrfC3T.js","icons/parking-180.png","icons/parking-192.png","icons/parking-32.png","icons/parking-48.png","icons/parking-512.png","icons/parking-maskable-512.png"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('parking-v2-') && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('index.html', self.registration.scope))));
  } else {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
