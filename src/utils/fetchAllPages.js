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
 * Fetches page 1, then (if more pages exist) fetches every remaining page
 * IN PARALLEL, and returns the combined, flattened item list.
 *
 * @param {(page: number) => Promise<import('axios').AxiosResponse>} requestPage
 * @returns {Promise<Array>}
 */
export async function fetchAllPages(requestPage) {
  const first = await requestPage(1);
  const firstItems = extractItems(first.data);
  const totalPages = first.data?.pages ?? 1;

  if (totalPages <= 1) return firstItems;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      requestPage(i + 2).then((r) => extractItems(r.data))
    )
  );

  return [firstItems, ...rest].flat();
}

export default fetchAllPages;
