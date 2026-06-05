const CACHE_NAME = "freeshare-cache-v2";
const OFFLINE_URLs = [
  "/",
  "/favicon.ico",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

// 1. Install event: Cache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static shell assets");
      return cache.addAll(OFFLINE_URLs);
    })
  );
  self.skipWaiting();
});

// 2. Activate event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch event: Network-first falling back to cache
self.addEventListener("fetch", (event) => {
  const isApiRoute = event.request.url.includes("/api/");
  const isCacheableApi = event.request.url.includes("/api/listings") || event.request.url.includes("/api/events");

  // Only cache GET requests and bypass browser extensions or non-cacheable API routes
  if (event.request.method !== "GET" || (isApiRoute && !isCacheableApi)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache clone of successful network response
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is down
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If accessing root, show fallback
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      })
  );
});

// 4. Push event: Receive Web Push Notifications
self.addEventListener("push", (event) => {
  let data = { title: "New Notification", body: "You have a new update from FreeShare India.", link: "/" };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // If data is text payload instead of JSON
      data = { title: "FreeShare Update", body: event.data.text(), link: "/" };
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: {
      link: data.link || "/"
    },
    vibrate: [100, 50, 100],
    actions: [
      { action: "open", title: "Open App" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. Notification click event: Navigate client
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.link || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 1. If matching window is already open, focus it and redirect
      for (const client of clientList) {
        const clientPath = new URL(client.url).pathname;
        const targetPath = new URL(targetUrl, client.url).pathname;
        if (clientPath === targetPath && "focus" in client) {
          return client.focus();
        }
      }
      
      // 2. Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
