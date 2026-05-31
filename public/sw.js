const CACHE_NAME = 'nexora-finance-v2';
const URLS = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS)));
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
