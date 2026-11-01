import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Precache exactly this compiled release, including hashed Vite assets.
export async function writeServiceWorker(root) {
  const files = ['index.html', 'manifest.webmanifest', 'favicon.ico'];
  for (const directory of ['assets', 'icons']) {
    for (const name of await readdir(new URL(`${directory}/`, root))) {
      if (name !== 'parking-master.png') files.push(`${directory}/${name}`);
    }
  }
  const hash = createHash('sha256');
  for (const file of files) hash.update(await readFile(new URL(file, root)));
  const cache = `parking-v2-${hash.digest('hex').slice(0, 16)}`;
  await writeFile(new URL('sw.js', root), `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files)};
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
`);
}
