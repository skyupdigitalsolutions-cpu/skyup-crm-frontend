// frontend/src/utils/dateUtils.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized date / timezone utilities for the entire frontend.
// ALL date comparisons and formatting MUST use these helpers so that
// IST (Asia/Kolkata) is consistently applied everywhere.
//
// Uses plain JS (no dayjs dependency) for zero bundle overhead.
// If you prefer dayjs, install it and swap the internals — the API stays same.
// ─────────────────────────────────────────────────────────────────────────────

const TIMEZONE  = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in ms

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Shift a UTC Date to its IST "wall clock" as a plain Date object.
 * NOTE: The resulting Date object's UTC value encodes the IST time —
 * it should only be used for getUTCHours / getUTCDate comparisons, not
 * passed to the backend as-is.
 */
export function toIST(date) {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS);
}

/**
 * Convert a Date (or ISO string) to a YYYY-MM-DD string in IST.
 * Used as the ?date= query param sent to the backend.
 */
export function toISTDateString(date) {
  const ist = toIST(date || new Date());
  const y   = ist.getUTCFullYear();
  const m   = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d   = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Return true if two dates (or ISO strings) fall on the same IST calendar day.
 */
export function isSameISTDay(a, b) {
  if (!a || !b) return false;
  return toISTDateString(a) === toISTDateString(b);
}

/**
 * Return true if the given date is today in IST.
 */
export function isToday(date) {
  return isSameISTDay(date, new Date());
}

/**
 * Add `n` days to a date (pure — does not mutate).
 */
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format as "Monday, 19 May 2026" in IST locale.
 */
export function formatLong(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: TIMEZONE,
  });
}

/**
 * Format as "19 May 2026".
 */
export function formatMedium(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: TIMEZONE,
  });
}

/**
 * Format as "19 May".
 */
export function formatShort(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short',
    timeZone: TIMEZONE,
  });
}

/**
 * Format as "10:35 AM" in IST.
 */
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: TIMEZONE,
  });
}

/**
 * Format as "19 May 2026, 10:35 AM".
 */
export function formatDateTime(date) {
  return `${formatMedium(date)}, ${formatTime(date)}`;
}

// ── IST day boundaries (for local display logic) ──────────────────────────────

/**
 * Return the IST start of day for a given date as a UTC Date.
 * Useful for client-side filtering of server timestamps.
 *
 * Example: for 2026-05-19, returns 2026-05-18T18:30:00.000Z (IST midnight in UTC)
 */
export function getISTDayStart(date) {
  const ist = toIST(date || new Date());
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export function getISTDayEnd(date) {
  const start = getISTDayStart(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// ── Follow-up urgency helper ──────────────────────────────────────────────────

/**
 * Given a scheduledAt date, return urgency metadata for rendering.
 * @returns {{ urgency: 'overdue'|'today'|'upcoming', daysLabel: string, dotColor: string }}
 */
export function getFollowUpUrgency(scheduledAt) {
  const now        = new Date();
  const todayStart = getISTDayStart(now);
  const todayEnd   = getISTDayEnd(now);
  const due        = new Date(scheduledAt);

  if (due < todayStart) {
    const daysOver = Math.max(1, Math.floor((todayStart - due) / 86400000));
    return {
      urgency:   'overdue',
      daysLabel: daysOver === 1 ? '1 day overdue' : `${daysOver} days overdue`,
      dotColor:  '#DC2626',
    };
  }
  if (due <= todayEnd) {
    return { urgency: 'today', daysLabel: 'Due today', dotColor: '#D97706' };
  }
  const daysAhead = Math.ceil((due - todayEnd) / 86400000);
  return {
    urgency:   'upcoming',
    daysLabel: daysAhead === 1 ? 'Due tomorrow' : `Due in ${daysAhead} days`,
    dotColor:  '#2563EB',
  };
}
