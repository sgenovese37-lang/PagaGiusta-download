/* PagaGiusta web app: funziona anche offline. Prima prova la rete (versione più nuova),
   se non c'è connessione usa la copia salvata. Non invia mai dati: scarica solo i file dell'app. */
var CACHE = 'pagagiusta-v1';
var FILES = ['./', 'index.html', 'css/app.css', 'js/pdf.js', 'js/busta.js', 'js/calc.js', 'js/app.js', 'manifest.webmanifest', 'img/apple-touch-icon.png', 'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(function (r) {
    if (r && r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); }); }));
});
