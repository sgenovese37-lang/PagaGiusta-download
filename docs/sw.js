/* PagaGiusta web app: funziona anche offline. Prima prova la rete (versione più nuova),
   se la rete non risponde in fretta o manca, usa la copia salvata. Non invia mai dati. */
var CACHE = 'pagagiusta-v3';
var FILES = ['./', 'index.html', 'css/app.css', 'js/versione.js', 'js/pdf.js', 'js/busta.js', 'js/calc.js', 'js/app.js', 'manifest.webmanifest', 'img/apple-touch-icon.png', 'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).catch(function () { }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function dallaCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(new Promise(function (resolve) {
    var fatto = false;
    // se la rete è lenta (oltre 3 secondi) e c'è una copia salvata, usa quella
    var timer = setTimeout(function () {
      dallaCache(req).then(function (r) { if (r && !fatto) { fatto = true; resolve(r); } });
    }, 3000);
    fetch(req).then(function (r) {
      clearTimeout(timer);
      if (r && r.ok) { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      if (!fatto) { fatto = true; resolve(r); }
    }).catch(function () {
      clearTimeout(timer);
      dallaCache(req).then(function (r) { if (!fatto) { fatto = true; resolve(r || Response.error()); } });
    });
  }));
});
