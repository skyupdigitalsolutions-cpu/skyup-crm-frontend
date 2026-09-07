// src/data/navigationService.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets code OUTSIDE the React tree (axiosConfig.js interceptors, etc.) trigger
// an in-app SPA navigation instead of window.location.href / reload.
//
// Why this exists:
//   axiosConfig.js's response interceptor used to do `window.location.href =
//   "/login"` (or "/upgrade-plan") on 401 / SUBSCRIPTION_EXPIRED. That forces
//   a full browser navigation — the entire document, JS bundle, and every
//   provider/context reloads from scratch — instead of a normal route swap.
//   That's what made opening a page that hit one of those responses feel like
//   "the whole app reloading", even though routing itself was already fixed
//   to mount the shell once (see AppLayout / AuthenticatedLayout in App.jsx).
//
// How it's wired:
//   App.jsx calls setNavigate(navigate) once, from inside <BrowserRouter>,
//   using React Router's real useNavigate(). Anything outside React (like
//   axiosConfig.js) then calls redirectTo(path) instead of touching
//   window.location directly.
// ─────────────────────────────────────────────────────────────────────────────

let _navigate = null;

/** Called once from inside the Router (App.jsx) to register the real navigate fn. */
export function setNavigate(navigateFn) {
  _navigate = navigateFn;
}

/**
 * Navigate to `path` via React Router if it's available yet, otherwise fall
 * back to a hard redirect (e.g. if something fires before the router mounts).
 * @param {string} path
 * @param {object} [options] - passed through to navigate(), e.g. { replace: true }
 */
export function redirectTo(path, options) {
  if (_navigate) {
    _navigate(path, options);
  } else {
    // Router not mounted yet — this should be rare, but don't silently no-op.
    window.location.href = path;
  }
}
