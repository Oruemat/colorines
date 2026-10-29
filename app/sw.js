// Service worker: guarda la app para que funcione sin internet.
// Al publicar cambios hay que subir VERSION para que la tablet descargue lo nuevo.
const VERSION = 'colorines-v2';
const FONTS = 'colorines-fonts';
const DRAWINGS = ['granja', 'selva', 'dinosaurios', 'mar', 'vehiculos', 'espacio', 'comida',
  'insectos', 'naturaleza', 'juguetes', 'mascotas', 'polo'];
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/art.js', 'js/engine.js', 'js/tools.js', 'js/storage.js', 'js/audio.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png',
  ...DRAWINGS.map((d) => `js/drawings/${d}.js`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // Primero la copia guardada; si no está, la red; sin red, la app.
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() =>
        (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
    );
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Tipografía: se guarda la primera vez que hay conexión.
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
