/* Stückmappe – Service Worker: macht die App offline-fähig.
   Bei jeder neuen Version die Nummer in VERSION erhöhen. */
var VERSION = 'stueckmappe-v2';
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'pdf.min.js',
  'pdf.worker.min.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== VERSION) return caches['delete'](k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Die App-Seite selbst: erst Netz versuchen (für Updates), nach 3 Sekunden oder offline aus dem Speicher.
   Alles andere: sofort aus dem Speicher. */
function fromNetworkWithTimeout(req, ms) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var t = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms);
    fetch(req).then(function (res) {
      if (done) return;
      done = true; clearTimeout(t);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
      }
      resolve(res);
    }, function (err) { if (!done) { done = true; clearTimeout(t); reject(err); } });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fromNetworkWithTimeout(req, 3000)['catch'](function () {
        return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    })
  );
});
