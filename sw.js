const CACHE_NAME = 'archive-audiobooks-v1';

// Get the base path dynamically
const BASE_PATH = self.registration.scope;

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll([
                    BASE_PATH,
                    BASE_PATH + 'index.html',
                    BASE_PATH + 'manifest.json',
                    'https://cdn.plyr.io/3.7.8/plyr.css',
                    'https://cdn.plyr.io/3.7.8/plyr.polyfilled.js',
                    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@400;500;600&display=swap'
                ]);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // For API calls to archive.org, use network-first strategy
    if (url.hostname === 'archive.org') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Clone response to cache it
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        // Only cache successful responses
                        if (response.status === 200) {
                            cache.put(request, responseClone);
                        }
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(request);
                })
        );
        return;
    }

    // For static assets, use cache-first strategy
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then(response => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200) {
                        return response;
                    }
                    // Clone and cache the response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });
                    return response;
                });
            })
    );
});

// Handle background sync for offline playback queue (future enhancement)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-playback') {
        console.log('Background sync triggered');
    }
});

// Handle push notifications (future enhancement)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New audiobook available!',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100]
    };
    event.waitUntil(
        self.registration.showNotification('Archive Audiobooks', options)
    );
});