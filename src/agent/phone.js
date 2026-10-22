// src/agent/phone.js — one place for phone numbers in the /agent web app.
//
// normalizePhone() is the SAME algorithm as the server's utils/normalizePhone.js (keep the two in step): it turns any
// format into the last 10 digits, or null. The server uses it to find and de-duplicate leads, so the app has to
// predict what the server will accept. checkPhoneInput() is stricter on purpose: it runs while a person TYPES a new
// number and refuses the inputs the server would quietly turn into a different number (an extension, two numbers
// pasted together, too many digits).

const COUNTRY_CODE_PREFIXES = ['0091', '091', '0044', '044', '001', '01', '0049', '049', '0061', '061', '0971', '971', '0966', '966'];

/** Same as the server: last 10 digits of any format, or null. */
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('9191') && digits.length === 14) digits = digits.slice(2);
  for (const prefix of COUNTRY_CODE_PREFIXES) {
    if (digits.startsWith(prefix) && digits.length > prefix.length) { digits = digits.slice(prefix.length); break; }
  }
  if (digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  if (digits.length !== 10) return null;
  if (/^(\d)\1{9}$/.test(digits)) return null;
  return digits;
}

/** Digits a number may have, by how it is written (no + sign = an Indian number). */
function plausibleLength(digits, hasPlus) {
  if (hasPlus) return digits.length >= 11 && digits.length <= 15;
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('0')) || (digits.length === 12 && digits.startsWith('91'))
    || (digits.length === 13 && digits.startsWith('091')) || (digits.length === 14 && digits.startsWith('0091'));
}

/**
 * Check a number somebody typed.  → { ok:false, message } or { ok:true, national, send, warning }
 *   national: the 10 digits the server will store for matching        send: what to send to the server
 *   warning:  a soft note (never blocks) for a 10-digit number that is not an Indian mobile
 */
export function checkPhoneInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { ok: false, message: 'Enter a phone number.' };
  if (/[^\x00-\x7F]/.test(s)) return { ok: false, message: 'Use the digits 0 to 9 only.' };
  if (/\band\b/i.test(s)) return { ok: false, message: 'Enter one phone number only.' };
  if (/[A-Za-z]/.test(s)) return { ok: false, message: 'Use digits only. Remove letters, extensions or notes.' };
  if (/[,;/|&\\]/.test(s)) return { ok: false, message: 'Enter one phone number only.' };
  if (/^[\s+().-]*$/.test(s)) return { ok: false, message: 'Enter a phone number.' };      // only a plus sign, brackets or dashes
  if (!/^\(?\s*\+?[\d\s().-]+$/.test(s)) return { ok: false, message: 'Use digits only. A number can start with + and have spaces or dashes.' };
  const digits = s.replace(/\D/g, '');
  if (!digits) return { ok: false, message: 'Enter a phone number.' };
  if (digits.length < 10) return { ok: false, message: `That number has only ${digits.length} digit${digits.length === 1 ? '' : 's'}. A phone number needs 10.` };
  if (digits.length > 15) return { ok: false, message: 'That number is too long (more than 15 digits). Check for a typo.' };
  const hasPlus = /^\(?\s*\+/.test(s);                       // "+91 …" and "(+91) …"
  if (!plausibleLength(digits, hasPlus)) return { ok: false, message: `That number has ${digits.length} digits, which does not match an Indian number (10 digits, or with 91 or 0 in front). Check it.` };
  const national = normalizePhone(s);
  if (!national) {
    if (/^(\d)\1+$/.test(digits.slice(-10))) return { ok: false, message: 'That is not a real number (the same digit repeated).' };
    return { ok: false, message: 'This number cannot be saved. Numbers from other countries must have a 10-digit national number.' };
  }
  const indian = !hasPlus || digits.startsWith('91');
  const send = indian ? national : `+${digits}`;
  const warning = indian && !/^[6-9]/.test(national) ? 'Indian mobile numbers start with 6, 7, 8 or 9. Continue only if this is a landline.' : '';
  return { ok: true, national, send, warning };
}

/** Digits for a wa.me link (country code included), or null when there is no usable number. */
export function whatsappDigits(raw) {
  const s = String(raw ?? '').trim();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (/^\(?\s*\+/.test(s) && !digits.startsWith('91')) return /^[1-9]\d{10,14}$/.test(digits) ? digits : null;   // another country, as written (a country code never starts with 0)
  const national = normalizePhone(s);
  if (national) {
    // a 12-15 digit number with a foreign code and no + sign (for example 447911123456) keeps its own code
    if (digits.length >= 11 && !digits.startsWith('91') && !digits.startsWith('0')) return digits.length <= 15 ? digits : null;
    return `91${national}`;
  }
  return null;
}
export const whatsappHref = (raw) => { const d = whatsappDigits(raw); return d ? `https://wa.me/${d}` : null; };
