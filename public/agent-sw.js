/* agent-sw.js — service worker for the Agent app PWA (scope: /agent)
 * ─────────────────────────────────────────────────────────────────────────────
 * What it does
 *   • Caches the app shell and the hashed build files (/assets/*) so the app
 *     opens fast and still opens with no signal.
 *   • Shows /agent-offline.html if the shell has never been cached.
 *
 * What it deliberately does NOT do
 *   • It never touches API calls or any other origin. Leads, attendance and
 *     sign-in always go to the network, and no lead or customer data is ever stored by
 *     this worker — only static files (HTML shell, JS, CSS, icons).
 *   • It does not queue or replay writes offline. A remark or clock-in is either saved on
 *     the server or it isn't, so nobody is misled about what was saved.
 *
 * Bump VERSION to force every device to drop its old caches.
 */
const VERSION = "v1";
const SHELL_CACHE = `agent-shell-${VERSION}`;
const ASSET_CACHE = `agent-assets-${VERSION}`;
const SHELL_KEY   = "/__agent-shell";          // where the SPA's index.html is kept
const OFFLINE_URL = "/agent-offline.html";
const PRECACHE    = [OFFLINE_URL, "/agent-manifest.json", "/agent-icons/icon-192.png", "/agent-icons/icon-512.png", "/agent-icons/apple-touch-180.png"];
const MAX_ASSET_ENTRIES = 80;                    // keep the asset cache from growing forever

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(PRECACHE);
    // The SPA serves the same index.html for every route; keep one copy as the offline shell.
    try {
      const res = await fetch("/index.html", { cache: "reload" });
      if (res && res.ok) await shell.put(SHELL_KEY, res);
    } catch (e) { /* offline during install — the offline page still works */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
    for (const name of await caches.keys()) {
      if (name.startsWith("agent-") && !keep.has(name)) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function trimAssets(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSET_ENTRIES; i++) await cache.delete(keys[i]);
}

// Hashed build files never change under the same name → cache first.
async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok && res.type === "basic") { await cache.put(request, res.clone()); trimAssets(cache); }
  return res;
}

// Pages: always try the network so a new deploy is picked up; fall back to the cached shell.
async function networkFirstPage(request) {
  const shell = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok && (res.headers.get("content-type") || "").includes("text/html")) await shell.put(SHELL_KEY, res.clone());
    return res;
  } catch (e) {
    return (await shell.match(SHELL_KEY)) || (await shell.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                          // writes are never intercepted
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // other origins (e.g. the API host, fonts)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io")) return;   // API: network only

  if (req.mode === "navigate") { event.respondWith(networkFirstPage(req)); return; }
  if (url.pathname.startsWith("/assets/")) { event.respondWith(cacheFirst(req)); return; }
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
