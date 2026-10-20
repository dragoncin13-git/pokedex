// Service Worker: hace que la Pokédex abra sin internet y sea instalable.
// Sube VERSION cada vez que cambies archivos del front.
const VERSION = 'pokedex-v2';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/styles.css',
  'js/app.js', 'js/api.js', 'js/config.js', 'js/tipos.js', 'js/voz.js', 'js/imagenes.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // subidas de imágenes, etc. → directo a la red
  const url = new URL(req.url);

  // Imágenes de sprites: cache-first (no cambian nunca)
  if (url.hostname === 'raw.githubusercontent.com' || req.destination === 'image') {
    e.respondWith(cacheFirst(req, `${VERSION}-img`));
    return;
  }
  // Back del curso (/api/pokemon*, /api/types): stale-while-revalidate, como pide el backlog (0.4).
  // Si ya se vio una vez, abre al instante (aunque Render esté dormido) y se actualiza por detrás.
  if (url.pathname.startsWith('/api/') && url.hostname !== 'pokeapi.co') {
    e.respondWith(staleWhileRevalidate(req, `${VERSION}-data`, false));
    return;
  }
  if (url.pathname === '/health') return; // siempre a la red
  // PokéAPI (complemento): red primero, y sin internet lo último guardado
  if (url.hostname === 'pokeapi.co') {
    e.respondWith(networkFirst(req, `${VERSION}-data`));
    return;
  }
  // App shell (html, css, js, fuentes): cache-first con actualización en segundo plano
  e.respondWith(staleWhileRevalidate(req, VERSION));
});

async function cacheFirst(req, nombre) {
  const c = await caches.open(nombre);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') c.put(req, res.clone());
  return res;
}

async function networkFirst(req, nombre) {
  const c = await caches.open(nombre);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch {
    const hit = await c.match(req);
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function staleWhileRevalidate(req, nombre, ignoreSearch = true) {
  const c = await caches.open(nombre);
  const hit = await c.match(req, { ignoreSearch });
  const red = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit ?? red.then((r) => r ?? Response.error());
}
