/* 壁纸预览台 Service Worker：HTML 走网络优先，静态资源走 stale-while-revalidate
   目的是「首次打开过之后，断网/弱网刷新也能用」——与页面 FAQ 的说法保持一致。 */
const VERSION = 'v1';
const HTML_CACHE = 'ws-html-' + VERSION;
const ASSET_CACHE = 'ws-asset-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先，失败回退缓存（保证拿到最新 HTML 与新的资源指纹）
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(HTML_CACHE);
        cache.put('/', fresh.clone());
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cache = await caches.open(HTML_CACHE);
        return (await cache.match(req)) || (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  // 其它同源资源：先给缓存，同时后台更新
  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const hit = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await network) || Response.error();
  })());
});
