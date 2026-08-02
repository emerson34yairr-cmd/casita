/* Service worker de la casita.
 *
 * A propósito va "primero la red": el juego es un archivo suelto que se
 * republica a menudo, y con una caché normal el icono de la pantalla de inicio
 * del iPhone se queda con la versión vieja para siempre. Así siempre se sirve
 * lo último que haya en GitHub Pages, y la caché solo entra cuando no hay red.
 */
const CACHE = 'casita-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-store' });
      if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      throw err;
    }
  })());
});
