// src/data/navigationService.js
// ─────────────────────────────────────────────────────────────────────────────
// Lets code OUTSIDE the React tree (axiosConfig.js interceptors, etc.) trigger
// an in-app SPA navigation instead of window.location.href / reload.
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
    window.location.href = path;
  }
}
