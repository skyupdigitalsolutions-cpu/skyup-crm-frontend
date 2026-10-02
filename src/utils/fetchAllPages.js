// src/utils/fetchAllPages.js
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT FIX (round-trip duplication): this exact "fetch page 1, read the
// total page count from it, then fetch every remaining page in parallel"
// pattern previously existed as three separate, subtly-different copies in
// AdminLeadsPage.jsx, UserDashboard.jsx, and UserLeadsPage.jsx — each one
// free to drift (different response-shape fallbacks, different edge-case
// handling) since none of them shared code.
//
// ROUND-TRIP NOTE (not fully solved by this helper): fetching page 1 must
// still complete before we know how many more pages exist, so this is an
// inherent 2-round-trip minimum for any dataset bigger than one page — that's
// a consequence of the backend's page-capped list endpoints, not something a
// client-side helper can eliminate. The real fix for large companies is a
// backend endpoint that returns aggregate numbers (counts, hot/warm/cold
// totals) directly, instead of the UI needing every full lead record just to
// compute a KPI. This helper's job is narrower: guarantee the "rest of the
// pages" step is ALWAYS parallel (never accidentally sequential) everywhere
// this pattern is used, and remove the 3-way duplication/drift risk.
//
// USAGE:
//   import { fetchAllPages } from "../utils/fetchAllPages";
//   import api from "../data/axiosConfig";
//
//   const leads = await fetchAllPages((page) =>
//     api.get(`/lead/my-leads?page=${page}&limit=200`)
//   );
//
// `requestPage(page)` must return an axios response whose `.data` is either:
//   - a bare array of items (legacy/non-paginated shape), or
//   - { leads: [...], pages: N }  (or { data: [...], pages: N })
// `pages` defaults to 1 if absent, so a non-paginated endpoint just returns
// its single page of items unchanged.
// ─────────────────────────────────────────────────────────────────────────────

function extractItems(data) {
  if (Array.isArray(data)) return data;
  return data?.leads ?? data?.data ?? [];
}

/**
 * Fetches page 1, then (if more pages exist) fetches the remaining pages in
 * parallel (max `concurrency` at a time) and returns the combined list.
 *
 * Options:
 *   onFirstPage(items, totalPages) — called as soon as page 1 arrives so the
 *     UI can render immediately instead of waiting for every page.
 *   concurrency — parallel requests for the remaining pages (default 4), so a
 *     big company doesn't fire 20+ requests at once and choke the server.
 *
 * @param {(page: number) => Promise<import('axios').AxiosResponse>} requestPage
 * @param {{ onFirstPage?: Function, concurrency?: number }} [opts]
 * @returns {Promise<Array>}
 */
export async function fetchAllPages(requestPage, opts = {}) {
  const { onFirstPage, concurrency = 4 } = opts;
  const first = await requestPage(1);
  const firstItems = extractItems(first.data);
  const totalPages = first.data?.pages ?? 1;

  if (onFirstPage) { try { onFirstPage(firstItems, totalPages); } catch (_) { /* ignore */ } }
  if (totalPages <= 1) return firstItems;

  const results = new Array(totalPages - 1);
  let next = 0;
  const worker = async () => {
    while (next < totalPages - 1) {
      const idx = next++;
      const r = await requestPage(idx + 2);
      results[idx] = extractItems(r.data);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, totalPages - 1) }, worker));

  return [firstItems, ...results].flat();
}

export default fetchAllPages;
