// src/utils/cryptoService.js
// ─────────────────────────────────────────────────────────────────────────────
// Client-side AES-256-GCM encryption/decryption for lead PII.
//
// WHAT GETS ENCRYPTED (before sending to backend):
//   mobile, remark, callHistory[].remark, meetingRemarks[].remark
//
// WHAT STAYS PLAINTEXT (backend needs these for server-side logic):
//   name, email, status, campaign, source, temperature, date, followUpDate,
//   company, user, ObjectId references, all boolean/numeric fields
//
// KEY HIERARCHY (per design report):
//   companyKey (32-byte hex) — received from backend at login, held in Redux
//   fieldKey   — HKDF(companyKey, fieldName) — unique per field type
//   Each encryption uses a fresh random 12-byte IV → safe to reuse fieldKey
//
// STORAGE FORMAT: "enc:<ivHex>:<ciphertextHex>:<authTagHex>"
//   Prefix "enc:" lets decryption detect encrypted vs plaintext strings.
//   Legacy plaintext values (pre-encryption migration) are returned as-is.
//
// USAGE in leadsApi / dataService:
//   import { encryptLead, decryptLead } from "../utils/cryptoService";
//   const payload = await encryptLead(formValues, companyKey);   // before POST
//   const display = await decryptLead(apiResponse, companyKey);  // after GET
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = "enc:";
const FIELDS_TO_ENCRYPT = ["mobile", "remark"]; // top-level lead fields

// ─────────────────────────────────────────────────────────────────────────────
// Low-level AES-256-GCM using the Web Crypto API (available in all modern
// browsers and React Native via react-native-quick-crypto polyfill).
// ─────────────────────────────────────────────────────────────────────────────

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bufferToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derive a 256-bit field-specific key from the company key using HKDF.
 * Different field names produce different keys → limits blast radius.
 */
async function deriveFieldKey(companyKeyHex, fieldName) {
  const rawKey   = hexToBuffer(companyKeyHex);
  const baseKey  = await crypto.subtle.importKey("raw", rawKey, "HKDF", false, ["deriveKey"]);
  const salt     = new TextEncoder().encode("skyup-crm-v1");
  const info     = new TextEncoder().encode(fieldName);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a plaintext string. Returns "enc:<iv>:<cipher>:<tag>".
 * Returns the original value unchanged if it's already encrypted or empty.
 */
async function encryptField(plaintext, companyKeyHex, fieldName) {
  if (!plaintext || !companyKeyHex) return plaintext;
  const s = String(plaintext);
  if (!s.trim()) return s;
  if (s.startsWith(PREFIX)) return s; // already encrypted — don't double-encrypt

  try {
    const key       = await deriveFieldKey(companyKeyHex, fieldName);
    const iv        = crypto.getRandomValues(new Uint8Array(12));
    const encoded   = new TextEncoder().encode(s);
    // AES-GCM appends the 16-byte auth tag to the ciphertext in Web Crypto
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    const full      = new Uint8Array(encrypted);
    const cipher    = full.slice(0, full.length - 16);
    const tag       = full.slice(full.length - 16);
    return `${PREFIX}${bufferToHex(iv)}:${bufferToHex(cipher)}:${bufferToHex(tag)}`;
  } catch (e) {
    console.error(`[cryptoService] encryptField(${fieldName}) failed:`, e.message);
    return plaintext; // fallback: store plaintext rather than lose data
  }
}

/**
 * Decrypt a stored ciphertext string. Returns the plaintext.
 * Returns the original value if it's not an encrypted string (legacy plaintext).
 */
async function decryptField(stored, companyKeyHex, fieldName) {
  if (!stored || !companyKeyHex) return stored;
  const s = String(stored);
  if (!s.startsWith(PREFIX)) return s; // legacy plaintext — return as-is

  try {
    const rest             = s.slice(PREFIX.length);
    const [ivHex, cipherHex, tagHex] = rest.split(":");
    const key              = await deriveFieldKey(companyKeyHex, fieldName);
    const iv               = hexToBuffer(ivHex);
    const cipherData       = hexToBuffer(cipherHex);
    const tag              = hexToBuffer(tagHex);
    // Reconstruct ciphertext + tag for Web Crypto (it expects them concatenated)
    const fullCipher       = new Uint8Array(cipherData.length + tag.length);
    fullCipher.set(cipherData);
    fullCipher.set(tag, cipherData.length);
    const decrypted        = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, fullCipher);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    // Wrong key or tampered data — return a masked placeholder so the UI
    // degrades gracefully instead of crashing.
    console.warn(`[cryptoService] decryptField(${fieldName}) failed — session key mismatch?`);
    return "••••••";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// High-level helpers: encrypt/decrypt a full lead object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute HMAC-SHA256(value, companyKey) — same as backend computeHmac.
 * Stored alongside encrypted mobile so backend can match inbound WhatsApp/calls.
 */
async function computeHmac(value, companyKeyHex) {
  if (!value || !companyKeyHex) return null;
  try {
    const keyData = hexToBuffer(companyKeyHex);
    const key = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(value)));
    return bufferToHex(sig);
  } catch (e) {
    console.error("[cryptoService] computeHmac failed:", e.message);
    return null;
  }
}

/**
 * Encrypt a lead object before sending to the backend.
 * Encrypts: mobile, remark, callHistory[].remark, meetingRemarks[].remark
 * Leaves plaintext: name, email, status, campaign, and all other fields.
 * Also computes mobileHash for backend WhatsApp/call matching.
 */
export async function encryptLead(lead, companyKey) {
  if (!companyKey || !lead) return lead;
  const out = { ...lead };

  // Top-level PII fields
  if (lead.mobile)  out.mobile  = await encryptField(lead.mobile,  companyKey, "mobile");
  if (lead.remark)  out.remark  = await encryptField(lead.remark,  companyKey, "remark");

  // mobileHash — lets backend match inbound WhatsApp/calls without decryption
  if (lead.mobile) {
    const { normalizePhone } = await import("../utils/normalizePhone");
    const norm = normalizePhone(lead.mobile);
    if (norm) out.mobileHash = await computeHmac(norm, companyKey);
  }

  // callHistory remarks
  if (Array.isArray(lead.callHistory)) {
    out.callHistory = await Promise.all(
      lead.callHistory.map(async (entry) => ({
        ...entry,
        remark: entry.remark
          ? await encryptField(entry.remark, companyKey, "remark")
          : entry.remark,
      }))
    );
  }

  // meetingRemarks remarks
  if (Array.isArray(lead.meetingRemarks)) {
    out.meetingRemarks = await Promise.all(
      lead.meetingRemarks.map(async (entry) => ({
        ...entry,
        remark: entry.remark
          ? await encryptField(entry.remark, companyKey, "remark")
          : entry.remark,
      }))
    );
  }

  return out;
}

/**
 * Decrypt a lead object received from the backend.
 * Decrypts the same fields that encryptLead encrypts.
 * Returns plaintext everywhere — UI components need zero changes.
 */
export async function decryptLead(lead, companyKey) {
  if (!lead) return lead;
  // If no companyKey (session expired), return masked values for encrypted fields
  if (!companyKey) {
    return {
      ...lead,
      mobile: lead.mobile?.startsWith(PREFIX) ? "••••••••••" : lead.mobile,
      remark: lead.remark?.startsWith(PREFIX) ? "••••••"      : lead.remark,
    };
  }

  const out = { ...lead };

  if (lead.mobile) out.mobile = await decryptField(lead.mobile, companyKey, "mobile");
  if (lead.remark) out.remark = await decryptField(lead.remark, companyKey, "remark");

  if (Array.isArray(lead.callHistory)) {
    out.callHistory = await Promise.all(
      lead.callHistory.map(async (entry) => ({
        ...entry,
        remark: entry.remark
          ? await decryptField(entry.remark, companyKey, "remark")
          : entry.remark,
      }))
    );
  }

  if (Array.isArray(lead.meetingRemarks)) {
    out.meetingRemarks = await Promise.all(
      lead.meetingRemarks.map(async (entry) => ({
        ...entry,
        remark: entry.remark
          ? await decryptField(entry.remark, companyKey, "remark")
          : entry.remark,
      }))
    );
  }

  return out;
}

/**
 * Decrypt an array of leads (e.g. the full leads list from GET /my-leads).
 */
export async function decryptLeads(leads, companyKey) {
  if (!Array.isArray(leads)) return leads;
  return Promise.all(leads.map((l) => decryptLead(l, companyKey)));
}