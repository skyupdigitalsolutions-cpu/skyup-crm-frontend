// src/utils/scrollTop.js — jump the page (and the app's scrolling content
// area) back to the beginning, e.g. after clearing filters or changing page.
export function scrollPageTop() {
  try {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelectorAll("main .overflow-y-auto, [data-scroll-root]").forEach((el) => { el.scrollTop = 0; });
  } catch { /* SSR / old browsers */ }
}
