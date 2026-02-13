// XDC SkyNet Service Worker
// Provides offline support and background sync for PWA

const CACHE_NAME = 'xdc-skynet-v1';
const STATIC_ASSETS = [
  '/',
  '/explorer',
  '/register',
  '/manifest.json',
  '/xdc-logo.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests (don't cache dynamic data)
  if (url.pathname.startsWith('/api/')) {
    // Network only for API requests
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached version and update in background
        fetch(request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response);
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          if (!response || !response.ok) {
            return response;
          }

          // Clone and cache the response
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Network failed, try to return offline fallback
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });
    })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'register-node') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Handle any queued background tasks
  console.log('[Service Worker] Background sync executed');
}

// Push notification support
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.message || 'New alert from XDC SkyNet',
    icon: '/xdc-logo.png',
    badge: '/xdc-logo.png',
    tag: data.tag || 'alert',
    requireInteraction: data.severity === 'critical',
    data: data,
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'XDC SkyNet Alert',
      options
    )
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  if (data?.nodeId) {
    url = `/nodes/${data.nodeId}`;
  } else if (data?.alertId) {
    url = '/alerts';
  }

  event.waitUntil(
    self.clients.openWindow(url)
  );
});
