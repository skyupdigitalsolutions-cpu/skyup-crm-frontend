// src/utils/serverTime.js
// ─────────────────────────────────────────────────────────────────────────────
// SERVER TIME OFFSET (web) — mirrors the mobile app's src/services/serverTime.js
//
// THE PROBLEM: the attendance live-timer on this dashboard computed elapsed
// time as `Date.now() - new Date(record.loginTime)`, mixing the ADMIN'S
// BROWSER/PC clock with the server-generated loginTime timestamp. The mobile
// app already corrects for this (device clocks drift/get misconfigured), but
// the web dashboard didn't — so an admin with a skewed PC clock would see a
// live "hours worked" number that genuinely disagreed with what the employee's
// phone showed, even though both are reading the exact same underlying
// attendance record. This made a correct backend record look like a sync bug.
//
// THE FIX: same approach as mobile — every HTTP response already carries an
// authoritative `Date` header. Track the rolling offset between that and the
// browser's own clock, and use serverNow() instead of Date.now() for anything
// computed from server timestamps. No extra requests, self-corrects as the
// app makes normal API calls.
// ─────────────────────────────────────────────────────────────────────────────

// offset = serverEpochMs - browserEpochMs
let _offsetMs = 0;
let _hasSynced = false;

/**
 * Feed a server `Date` response header in to update the offset. Safe to call
 * on every response — invalid/missing values are ignored.
 */
export function recordServerDate(dateHeader) {
  if (!dateHeader) return;
  try {
    const serverMs = new Date(dateHeader).getTime();
    if (!Number.isFinite(serverMs)) return;
    _offsetMs = serverMs - Date.now();
    _hasSynced = true;
  } catch {
    // Ignore — keep whatever offset we already had.
  }
}

/** Server-corrected "now" in epoch ms. Falls back to browser time pre-sync. */
export function serverNow() {
  return Date.now() + _offsetMs;
}

/** True once at least one server Date header has been seen. */
export function hasSyncedClock() {
  return _hasSynced;
}

export default { recordServerDate, serverNow, hasSyncedClock };
