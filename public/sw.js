const CACHE_NAME = 'uptimyzas-kitchen-v3';
const urlsToCache = ['/'];

// 1. Install Event - Cache initial shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// 2. Activate Event - Clean up any old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Safely route login and API requests around the cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // BYPASS INTERCEPTION: Do not cache non-GET requests (POST login actions)
  // or requests bound for authentication paths, backend APIs, or Supabase.
  if (
    event.request.method !== 'GET' || 
    url.pathname.includes('/auth/') || 
    url.pathname.includes('/api/') || 
    url.hostname.includes('supabase.co')
  ) {
    return; // Pass through straight to the server normally
  }

  // CACHE-FIRST STRATEGY: Handle static pages and assets safely
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Only cache successful network responses
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });

        return networkResponse;
      });
    }).catch(() => {
      // Fallback to home shell if network fails entirely offline
      return caches.match('/');
    })
  );
});
