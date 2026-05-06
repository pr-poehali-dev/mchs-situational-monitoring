// Service Worker — АРМ Дежурного ВГСЧ МЧС России
// Версия кэша — меняй при обновлении ресурсов

const CACHE_APP    = "vgsch-app-v2";
const CACHE_FONTS  = "vgsch-fonts-v2";
const CACHE_CDN    = "vgsch-cdn-v2";
const CACHE_WEATHER = "vgsch-weather-v2";

const ALL_CACHES = [CACHE_APP, CACHE_FONTS, CACHE_CDN, CACHE_WEATHER];

// Кэшируем сразу при установке
const PRECACHE = ["/", "/tablo", "/index.html", "/manifest.webmanifest"];

// ── Установка ────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Активация: чистим старые кэши ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Перехват запросов ─────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol === "chrome-extension:") return;

  // 1. Погода — сначала сеть (5 сек таймаут), потом кэш
  if (url.hostname === "api.open-meteo.com") {
    event.respondWith(networkFirst(request, CACHE_WEATHER, 5000));
    return;
  }

  // 2. Шрифты Google — только кэш (не меняются)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  // 3. CDN (логотип, иконки) — только кэш
  if (url.hostname === "cdn.poehali.dev") {
    event.respondWith(cacheFirst(request, CACHE_CDN));
    return;
  }

  // 4. JS / CSS / изображения приложения — актуальный кэш + фоновое обновление
  if (
    url.origin === self.location.origin &&
    (request.destination === "script" ||
     request.destination === "style"  ||
     request.destination === "image"  ||
     request.destination === "font")
  ) {
    event.respondWith(staleWhileRevalidate(request, CACHE_APP));
    return;
  }

  // 5. HTML-навигация — сеть, при отказе — /index.html из кэша
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/index.html").then((r) => r || caches.match("/"))
      )
    );
    return;
  }
});

// ── Стратегии ────────────────────────────────────────────────────────────────

/** Cache First: кэш → сеть (если нет в кэше) */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Нет соединения", { status: 503 });
  }
}

/** Network First: сеть → кэш (с таймаутом) */
async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    clearTimeout(timer);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Stale While Revalidate: кэш сразу + обновление в фоне */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}
