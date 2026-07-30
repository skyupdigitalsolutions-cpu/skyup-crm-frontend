// src/utils/passwordPolicy.js
// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE MIRROR of the backend's utils/passwordPolicy.js
// ISO/IEC 27001:2022 — A.5.17 Authentication information
//
// This does NOT replace the backend check — the server is always the source
// of truth and re-validates on every request. This module only gives the user
// instant feedback instead of a round-trip 400 after they submit.
//
// Keep MIN_LENGTH and the character-class rule in sync with the backend's
// utils/passwordPolicy.js. If one changes, change both.
// ─────────────────────────────────────────────────────────────────────────────

export const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

const COMMON = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789",
  "qwerty", "qwerty123", "abc123", "111111", "iloveyou", "admin", "admin123",
  "letmein", "welcome", "welcome1", "monkey", "dragon", "sunshine", "princess",
  "football", "changeme", "passw0rd", "p@ssw0rd", "test1234", "india123",
]);

/**
 * Validate a password against the same policy the backend enforces.
 * @param {string} password
 * @param {{email?:string,name?:string}} [context] - reject passwords that
 *        just echo the user's own identifiers.
 * @returns {{valid:boolean, errors:string[]}}
 */
export function validatePassword(password, context = {}) {
  const errors = [];
  const pw = String(password || "");

  if (pw.length < MIN_LENGTH) errors.push(`Password must be at least ${MIN_LENGTH} characters.`);
  if (pw.length > MAX_LENGTH) errors.push(`Password must be at most ${MAX_LENGTH} characters.`);

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) {
    errors.push("Password must include at least three of: lowercase, uppercase, number, symbol.");
  }

  if (/^(.)\1+$/.test(pw)) errors.push("Password cannot be a single repeated character.");
  if (/^(?:0123456789|abcdefghij|qwertyuiop)/i.test(pw)) errors.push("Password cannot be a simple sequence.");
  if (COMMON.has(pw.toLowerCase())) errors.push("This password is far too common — choose something less guessable.");

  const { email, name } = context;
  if (email && pw.toLowerCase().includes(String(email).split("@")[0].toLowerCase())) {
    errors.push("Password cannot contain your email address.");
  }
  if (name && pw.toLowerCase().includes(String(name).toLowerCase())) {
    errors.push("Password cannot contain your name.");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Lightweight strength meter for a live UI indicator (separate from the
 * pass/fail validatePassword above — this is cosmetic, not a gate).
 */
export function passwordStrength(pwd) {
  if (!pwd) return { label: "", color: "", score: 0 };
  let score = 0;
  if (pwd.length >= MIN_LENGTH) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (pwd.length >= MIN_LENGTH && COMMON.has(pwd.toLowerCase())) score = 0;

  const levels = [
    { label: "Too weak", color: "bg-red-500" },
    { label: "Weak", color: "bg-orange-400" },
    { label: "Fair", color: "bg-yellow-400" },
    { label: "Good", color: "bg-lime-500" },
    { label: "Strong", color: "bg-green-500" },
  ];
  return { ...levels[Math.min(score, levels.length - 1)], score };
}
