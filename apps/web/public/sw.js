// Vow service worker — app-shell cache + offline fallback only.
// DASHBOARD_UX_AUDIT §A7: do NOT cache /api/* (health data), only static shell assets.
const CACHE = 'vow-shell-v1'
const SHELL = ['/', '/offline.html', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept API calls — always hit the network, never serve stale/cached health data.
  if (url.pathname.startsWith('/api/')) return

  // Navigations: network first, fall back to cached shell, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((r) => r || caches.match('/')))
    )
    return
  }

  // Static assets: cache-first, then network, with a best-effort cache update.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(request, res.clone()))
          return res
        })
        .catch(() => cached)
    })
  )
})
