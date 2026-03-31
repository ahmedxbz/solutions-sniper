const CACHE_NAME = 'sniper-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Never cache POST requests to the AI API
  if (event.request.method === 'POST') return; 
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached PWA file, else fetch from network
        if (response) return response;
        return fetch(event.request);
      })
  );
});
