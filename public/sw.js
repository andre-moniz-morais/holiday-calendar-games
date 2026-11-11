/* Natal a Dois — service worker
 * - Static assets (Next chunks, heads, photos, icons, fonts): cache-first.
 * - Pages: network-first, falling back to the cached copy when offline.
 * - API calls: always network (the app keeps its own offline copy of the state).
 */
const VERSION = "natal-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

const PRECACHE = [
  "/",
  "/games",
  "/leaderboard",
  "/heads/duda-256.webp",
  "/heads/filipino-256.webp",
  "/heads/duda-512.webp",
  "/heads/filipino-512.webp",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/heads/") ||
  url.pathname.startsWith("/photos/") ||
  url.pathname.startsWith("/icons/") ||
  /\.(woff2?|png|webp|glb|svg)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
  }
});
