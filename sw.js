const CACHE_NAME = 'bizcard-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event
// ネットワーク優先: 常に最新ファイルの取得を試み、オフライン時のみキャッシュにフォールバックする。
// これによりデプロイ時にCACHE_NAMEを手動更新しなくても、アプリを開くたびに最新の内容が反映される。
self.addEventListener('fetch', (e) => {
  // 外部（Google関連含む）へのリクエストはすべてキャッシュ対象外とし、ブラウザに直接処理させる。
  // Picker機能で使うapis.google.com/gstatic.com等、ドメインを列挙する方式は漏れが起きやすいため、
  // 自オリジン以外は一律で素通しする
  if (new URL(e.request.url).origin !== self.location.origin) {
    return; // Let browser handle network
  }

  if (e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback for offline if navigating
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
