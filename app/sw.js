/* Service worker mínimo: cachea el shell de la app para que sea instalable
   y arranque offline. NO cachea streams ni el catálogo (siempre en vivo). */
var CACHE = 'eoplay-shell-v1';
var SHELL = ['.', 'index.html', 'app.js', 'manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(u).catch(function () {});   // no fallar si un recurso no cachea
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var url = e.request.url;
  // Nunca interceptar el proxy (streams/catálogo): siempre red.
  if (url.indexOf('/proxy/') >= 0 || url.indexOf('player_api.php') >= 0) return;
  // Shell: cache-first con respaldo a red.
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request);
  }));
});
