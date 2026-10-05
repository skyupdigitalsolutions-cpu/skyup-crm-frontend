// src/utils/passwordPolicy.js
// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE MIRROR of the backend's utils/passwordPolicy.js
// ISO/IEC 27001:2022 — A.5.17 Authentication information
//
// This does NOT replace the backend check — the server is always the source
// of truth and re-validates on every request. This module gives the user a
// live checklist while typing instead of a round-trip 400 after submit.
//
// Keep MIN_LENGTH, MAX_LENGTH, MIN_SPECIAL and the rules below in sync with the
// backend's utils/passwordPolicy.js. If one changes, change both.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_LENGTH  = 10;
export const MAX_LENGTH  = 28;
export const MIN_SPECIAL = 2;
export const SPECIAL_EXAMPLES = "$ # ^ @ & % _ . ~ ! * -";

const COMMON = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "111111", "iloveyou", "admin", "admin123",
  "letmein", "welcome", "welcome1", "monkey", "dragon", "sunshine", "princess",
  "football", "changeme", "passw0rd", "p@ssw0rd", "test1234", "india123",
]);

// Email username + each word of the name (3+ chars), same as the server.
function identityParts({ email, name } = {}) {
  const parts = [];
  const local = String(email || "").toLowerCase().split("@")[0].trim();
  if (local.length >= 3) parts.push(local);
  String(name || "").toLowerCase().split(/[\s._-]+/).forEach((w) => {
    if (w.length >= 3) parts.push(w);
  });
  return [...new Set(parts)];
}

const countSpecial = (pw) => (pw.match(/[^A-Za-z0-9\s]/g) || []).length;

/**
 * The checklist shown under every "set password" field.
 * Each item: { id, label, ok }. `extra` items only appear when they fail, so
 * the visible list stays short but the UI never shows all-green for a password
 * the server would reject.
 * @param {string} password
 * @param {{email?:string,name?:string}} [context]
 */
export function getPasswordChecks(password, context = {}) {
  const pw = String(password || "");
  const lower = pw.toLowerCase();

  const checks = [
    { id: "length",  label: `${MIN_LENGTH}-${MAX_LENGTH} characters`, ok: pw.length >= MIN_LENGTH && pw.length <= MAX_LENGTH, error: `Password must be ${MIN_LENGTH}-${MAX_LENGTH} characters long.` },
    { id: "upper",   label: "At least one capital letter [A-Z]",       ok: /[A-Z]/.test(pw), error: "Password must contain at least one capital letter (A-Z)." },
    { id: "lower",   label: "At least one small letter [a-z]",         ok: /[a-z]/.test(pw), error: "Password must contain at least one small letter (a-z)." },
    { id: "number",  label: "At least one number",                     ok: /[0-9]/.test(pw), error: "Password must contain at least one number." },
    { id: "special", label: `At least two special characters (${SPECIAL_EXAMPLES})`, ok: countSpecial(pw) >= MIN_SPECIAL, error: `Password must contain at least ${MIN_SPECIAL} special characters.` },
    { id: "spaces",  label: "No spaces",                               ok: pw.length > 0 && !/\s/.test(pw), error: "Password must not contain spaces." },
    {
      id: "identity",
      label: "Must not contain the user ID (email name), first name or last name",
      ok: pw.length > 0 && !identityParts(context).some((part) => lower.includes(part)),
      error: "Password must not contain your user ID, first name or last name.",
    },
  ];

  if (pw.length > 0) {
    if (/^(.)\1+$/.test(pw)) checks.push({ id: "repeat", label: "Must not be one repeated character", ok: false, extra: true });
    if (/^(?:0123456789|abcdefghij|qwertyuiop)/i.test(pw)) checks.push({ id: "sequence", label: "Must not start with a simple sequence (e.g. qwertyuiop)", ok: false, extra: true });
    if (COMMON.has(lower)) checks.push({ id: "common", label: "Must not be a common password", ok: false, extra: true });
  }

  return checks;
}

/**
 * Validate a password against the same policy the backend enforces.
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validatePassword(password, context = {}) {
  const errors = getPasswordChecks(password, context)
    .filter((c) => !c.ok)
    .map((c) => c.error || c.label);
  return { valid: errors.length === 0, errors };
}

/**
 * Strength label for the meter. Cosmetic only — validatePassword is the gate.
 * Returns score 0–4.
 */
export function passwordStrength(pwd, context = {}) {
  if (!pwd) return { label: "", color: "", text: "", score: 0 };
  const checks = getPasswordChecks(pwd, context);
  const passed = checks.filter((c) => c.ok).length;
  const allOk  = checks.every((c) => c.ok);

  let score;
  if (allOk) score = pwd.length >= 14 || countSpecial(pwd) >= 3 ? 4 : 3;
  else if (passed >= 5) score = 2;
  else if (passed >= 3) score = 1;
  else score = 0;

  const levels = [
    { label: "Too weak", color: "bg-red-500",     text: "text-red-600 dark:text-red-400" },
    { label: "Weak",     color: "bg-orange-500",  text: "text-orange-600 dark:text-orange-400" },
    { label: "Fair",     color: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400" },
    { label: "Good",     color: "bg-lime-500",    text: "text-lime-700 dark:text-lime-400" },
    { label: "Strong",   color: "bg-green-600",   text: "text-green-700 dark:text-green-400" },
  ];
  return { ...levels[score], score };
}

/**
 * Generate a random password that always satisfies the policy.
 * Uses crypto.getRandomValues; avoids look-alike characters (0/O, 1/l/I).
 */
export function generateStrongPassword(length = 14, context = {}) {
  const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const LOWER = "abcdefghjkmnpqrstuvwxyz";
  const DIGIT = "23456789";
  const SPEC  = "@#$%&*!_-";
  const ALL   = UPPER + LOWER + DIGIT + SPEC;
  const len   = Math.min(Math.max(length, MIN_LENGTH), MAX_LENGTH);

  const rand = (n) => {
    const a = new Uint32Array(1);
    (globalThis.crypto || window.crypto).getRandomValues(a);
    return a[0] % n;
  };
  const pick = (set) => set[rand(set.length)];

  for (let attempt = 0; attempt < 20; attempt++) {
    const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SPEC), pick(SPEC)];
    while (chars.length < len) chars.push(pick(ALL));
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const pw = chars.join("");
    if (validatePassword(pw, context).valid) return pw;
  }
  return "Sk@y#" + Date.now().toString(36).slice(-6) + "Up9"; // practically unreachable
}
