const CACHE_NAME = 'taxflow-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/offline',
]

// Install - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET and API requests
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return
  if (event.request.url.includes('supabase')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached
          // Fallback to offline page for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/offline')
          }
        })
      })
  )
})
