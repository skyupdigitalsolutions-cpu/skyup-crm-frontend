/**
 * src/utils/normalizePhone.js  — Frontend phone normalizer
 *
 * Mirrors the logic in backend/utils/normalizePhone.js exactly.
 * Keep both files in sync if you add new country codes.
 *
 * Usage:
 *   import { normalizePhone, isSamePhone } from '../utils/normalizePhone';
 *
 *   const norm = normalizePhone('+91 98765 43210'); // → "9876543210"
 *   const same = isSamePhone('09876543210', '919876543210'); // → true
 */

const COUNTRY_CODE_PREFIXES = [
  '0091', '091', '0044', '044',
  '001',  '01',
  '0049', '049',
  '0061', '061',
  '0971', '971',
  '0966', '966',
];

/**
 * Normalize a phone number to its last 10 digits.
 * @param {string|number} raw
 * @returns {string|null} 10-digit string or null if invalid
 */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;

  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // ── FIX: Handle double-country-code caused by bad bulk Atlas updates ──────
  // When a number like "+918496868060" (already correct E.164) gets "+91"
  // prepended again, it becomes "+91918496868060" → digits "91918496868060" (14 digits).
  // Detect: starts with "9191" and length is 14 → strip the extra "91" prefix.
  if (digits.startsWith('9191') && digits.length === 14) {
    digits = digits.slice(2); // "91918496868060" → "918496868060"
  }

  for (const prefix of COUNTRY_CODE_PREFIXES) {
    if (digits.startsWith(prefix) && digits.length > prefix.length) {
      digits = digits.slice(prefix.length);
      break;
    }
  }

  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  if (digits.length !== 10) return null;

  // Reject all-same-digit numbers (e.g. 0000000000)
  if (/^(\d)\1{9}$/.test(digits)) return null;

  return digits;
}

/**
 * Safe version — never throws.
 */
export function normalizePhoneSafe(raw) {
  try { return normalizePhone(raw); } catch { return null; }
}

/**
 * Returns true if two values represent the same phone number.
 */
export function isSamePhone(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return na !== null && nb !== null && na === nb;
}

/**
 * Returns true if the string looks like a valid Indian mobile number
 * (starts with 6-9, exactly 10 digits after normalization).
 */
export function isValidIndianMobile(raw) {
  const norm = normalizePhone(raw);
  return norm !== null && /^[6-9]\d{9}$/.test(norm);
}
