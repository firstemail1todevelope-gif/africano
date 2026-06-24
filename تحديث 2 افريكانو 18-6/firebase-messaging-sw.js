/* ================================================================
   firebase-messaging-sw.js  
   ✅ Service Worker كامل للـ PWA — Offline + Cache + Notifications
   ================================================================ */

const CACHE_NAME = 'africano-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

/* ── Install: cache الملفات الأساسية ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(OFFLINE_URLS).catch(err => {
        console.warn('[SW] Some files failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: احذف الـ caches القديمة ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

/* ── Fetch: Network first, fallback to cache ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  
  // تجاهل طلبات Firebase و Telegram و APIs الخارجية
  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('telegram') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('ntfy')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // حفظ في الـ cache لو ناجح
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // لو فشل الـ network، جيب من الـ cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // لو مفيش في الـ cache، رجّع الـ index.html (للـ SPA)
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

/* ── Notification Click ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

/* ── Push Notifications (للمستقبل) ── */
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'صالون افريكانو', {
        body: data.body || 'لديك إشعار جديد',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        dir: 'rtl',
        lang: 'ar',
        vibrate: [200, 100, 200],
        data: data.data || {}
      })
    );
  } catch(e) {
    console.warn('[SW] Push parse error:', e);
  }
});

/* ── Background Sync (للحجوزات offline) ── */
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-bookings') {
    event.waitUntil(
      clients.matchAll().then(clientList => {
        clientList.forEach(client => client.postMessage({ type: 'SYNC_BOOKINGS' }));
      })
    );
  }
});
