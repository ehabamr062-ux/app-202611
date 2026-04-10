// ============================================================
//  Service Worker - تطبيق المحاسبة اليومي
//  النسخة: 1.1.0 (تحديث الأيقونات)
// ============================================================

const CACHE_NAME = 'mohassaba-v2';
const STATIC_CACHE = 'mohassaba-static-v2';
const DYNAMIC_CACHE = 'mohassaba-dynamic-v2';

// الملفات الأساسية التي يجب تخزينها مسبقاً
const STATIC_FILES = [
    './',
    './index.html',
    './manifest.json',
    './database-api.js',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=El+Messiri:wght@400;600;700&display=swap',
];

// CDN libraries - نحاول نخزنها لو الشبكة شغّالة
const CDN_FILES = [
    'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
];

// ============================================================
//  Install Event - تثبيت الـ Service Worker
// ============================================================
self.addEventListener('install', (event) => {
    console.log('[SW] 🚀 جاري التثبيت...');

    event.waitUntil(
        Promise.all([
            // تخزين الملفات الأساسية
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('[SW] ✅ تخزين الملفات الأساسية');
                return cache.addAll(STATIC_FILES);
            }),
            // تخزين مكتبات CDN (لا يوقف التثبيت لو فشل)
            caches.open(DYNAMIC_CACHE).then(async (cache) => {
                for (const url of CDN_FILES) {
                    try {
                        await cache.add(url);
                        console.log('[SW] ✅ تم تخزين:', url);
                    } catch (e) {
                        console.warn('[SW] ⚠️ تعذّر تخزين:', url);
                    }
                }
            }),
        ]).then(() => {
            console.log('[SW] 🎉 اكتمل التثبيت');
            return self.skipWaiting(); // فعّل الـ SW مباشرة
        })
    );
});

// ============================================================
//  Activate Event - تفعيل الـ Service Worker
// ============================================================
self.addEventListener('activate', (event) => {
    console.log('[SW] ⚡ جاري التفعيل...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                    .map((name) => {
                        console.log('[SW] 🗑️ حذف كاش قديم:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] ✅ جاهز للعمل!');
            return self.clients.claim();
        })
    );
});

// ============================================================
//  Fetch Event - التحكم في الطلبات
// ============================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // تجاهل طلبات chrome-extension وغيرها
    if (!request.url.startsWith('http')) return;

    // تجاهل طلبات Socket.IO (real-time لازم دايماً شبكة)
    if (url.pathname.includes('socket.io')) return;

    // تجاهل الـ API requests
    if (url.pathname.includes('/api/')) return;

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // موجود في الكاش - رجّعه مباشرة
                return cachedResponse;
            }

            // مش في الكاش - جيبه من الشبكة وخزّنه
            return fetch(request).then((networkResponse) => {
                // تأكد إن الرسبونس صالح
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
                    return networkResponse;
                }

                // خزّن في الكاش الديناميكي
                const responseClone = networkResponse.clone();
                caches.open(DYNAMIC_CACHE).then((cache) => {
                    cache.put(request, responseClone);
                });

                return networkResponse;
            }).catch(() => {
                // الشبكة فشلت - حاول ترجّع صفحة أوفلاين
                if (request.destination === 'document') {
                    return caches.match('./index.html');
                }

                // للصور ارجع صورة افتراضية
                if (request.destination === 'image') {
                    return new Response(
                        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#d4af37"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">💰</text></svg>',
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                }
            });
        })
    );
});

// ============================================================
//  Background Sync - مزامنة في الخلفية
// ============================================================
self.addEventListener('sync', (event) => {
    console.log('[SW] 🔄 Background Sync:', event.tag);

    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncTransactions());
    }
});

async function syncTransactions() {
    console.log('[SW] 📊 جاري مزامنة المعاملات...');
    // هنا ممكن تضيف منطق المزامنة مع الخادم لو احتجت
}

// ============================================================
//  Push Notifications - الإشعارات
// ============================================================
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'لديك تحديث جديد',
        icon: './icons/icon-192x192.png',
        badge: './icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        dir: 'rtl',
        lang: 'ar',
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'explore', title: 'فتح التطبيق' },
            { action: 'close', title: 'إغلاق' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('📊 تطبيق المحاسبة', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('./index.html')
        );
    }
});

console.log('[SW] 📱 Service Worker محمّل - تطبيق المحاسبة اليومي');
