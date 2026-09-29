// src/utils/chunkReload.js
// ─────────────────────────────────────────────────────────────────────────────
// Recovery for "stale deploy" chunk errors.
//
// Every deploy renames the hashed JS/CSS files in /assets and removes the old
// ones. A browser still holding the previous index.html (tab left open, or a
// cached copy) then requests files that no longer exist. Cloudflare's SPA
// fallback (wrangler.toml → not_found_handling = "single-page-application")
// answers with index.html, so the browser gets HTML where it expected JS and
// throws "Failed to fetch dynamically imported module" / "MIME type text/html".
//
// Re-rendering can't fix this: React.lazy caches the rejected import forever.
// The only fix is a full reload, which fetches the NEW index.html.
//
// Loop guard: we reload at most once per RELOAD_WINDOW_MS. If the error comes
// back right after a reload, the problem isn't a stale tab (e.g. the deploy is
// genuinely broken), so we stop and let the UI show a manual "Reload" button.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = "chunk_reload_at";
const RELOAD_WINDOW_MS = 15000;

export function isChunkLoadError(error) {
  const msg = String((error && error.message) || error || "");
  return (
    (error && error.name === "ChunkLoadError") ||
    msg.includes("Loading chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("Importing a module script failed") || // Safari
    msg.includes("error loading dynamically imported module") || // Firefox
    msg.includes("Unable to preload CSS")
  );
}

// Returns true if a reload was triggered, false if we already tried recently.
export function reloadOnceForChunkError() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* storage blocked */ }
  if (Date.now() - last < RELOAD_WINDOW_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ }
  window.location.reload();
  return true;
}
