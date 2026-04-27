// src/utils/CRMEncryption.js
// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND ZERO-KNOWLEDGE ENCRYPTION — BIP39 Edition
//
// THE RECOVERY PROBLEM SOLVED:
//   Before: Client had a random AES key → "a3f9b1c2..." → impossible to memorize
//           Lost key = lost data forever ❌
//
//   Now:    Client has a 12-word mnemonic → "apple orange river moon king fish..."
//           Writable on paper, saveable in password manager ✅
//           Same 12 words → same AES-256 key → same decryption, always ✅
//           Lost phone? New browser? Just re-enter 12 words → full access ✅
//
// HOW IT WORKS:
//   1. Generate 12-word BIP39 mnemonic on client device
//   2. Derive 32-byte AES-256 key: mnemonic → seed (PBKDF2) → first 32 bytes
//   3. Send mnemonic to server — server derives + hashes → stores hash only
//   4. Encrypt lead data with AES-GCM before sending to server
//   5. Server stores only ciphertext — sees gibberish
//   6. Decrypt on client using same key derived from the 12 words
//
// DEPENDENCIES:
//   npm install bip39
// ─────────────────────────────────────────────────────────────────────────────

import * as bip39 from "bip39";

class CRMEncryption {
  constructor() {
    this.KEY_STORAGE = "crm_encryption_key"; // stores derived hex key in localStorage
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
  }

  // ── Generate a new 12-word BIP39 mnemonic ──────────────────────────────────
  generateMnemonic() {
    return bip39.generateMnemonic();
  }

  // ── Validate a mnemonic phrase ─────────────────────────────────────────────
  validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic.trim().toLowerCase());
  }

  // ── Derive AES-256 key (hex) from a mnemonic ──────────────────────────────
  // DETERMINISTIC: same mnemonic → same 32-byte key, always.
  // This is the core of recovery.
  async deriveKeyFromMnemonic(mnemonic) {
    const normalized = mnemonic.trim().toLowerCase();
    if (!bip39.validateMnemonic(normalized)) {
      throw new Error("Invalid mnemonic phrase. Check your 12 words.");
    }
    const seedBuffer = bip39.mnemonicToSeedSync(normalized); // 64-byte Buffer
    const keyBytes = seedBuffer.slice(0, 32);                // first 32 bytes = AES-256
    return Array.from(keyBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // ── Import a hex key into a CryptoKey for WebCrypto API ───────────────────
  async importHexKey(hexKey) {
    const keyBytes = new Uint8Array(hexKey.match(/.{2}/g).map(b => parseInt(b, 16)));
    return await window.crypto.subtle.importKey(
      "raw", keyBytes, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }

  // ── Hash the hex key (to send to server for verification) ─────────────────
  async hashKey(hexKey) {
    const data = this.encoder.encode(hexKey);
    const hash = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // ── Save derived key to localStorage ──────────────────────────────────────
  saveKeyLocally(hexKey) { localStorage.setItem(this.KEY_STORAGE, hexKey); }

  // ── Get stored hex key ─────────────────────────────────────────────────────
  getLocalKey() { return localStorage.getItem(this.KEY_STORAGE); }

  // ── Clear stored key (on logout) ──────────────────────────────────────────
  clearLocalKey() { localStorage.removeItem(this.KEY_STORAGE); }

  // ── Encrypt data (AES-256-GCM) before sending to server ───────────────────
  async encrypt(data, hexKey) {
    const cryptoKey = await this.importHexKey(hexKey);
    const iv        = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded   = this.encoder.encode(JSON.stringify(data));
    const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoded);
    const result    = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...result));
  }

  // ── Decrypt data received from server ─────────────────────────────────────
  async decrypt(encryptedString, hexKey) {
    const cryptoKey = await this.importHexKey(hexKey);
    const data      = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));
    const iv        = data.slice(0, 12);
    const encrypted = data.slice(12);
    const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encrypted);
    return JSON.parse(this.decoder.decode(decrypted));
  }

  // ── SETUP FLOW (first admin login) ────────────────────────────────────────
  // 1. Generates a 12-word mnemonic
  // 2. Derives AES-256 key from mnemonic
  // 3. Saves key to localStorage
  // 4. Sends mnemonic to server (server derives+hashes, discards mnemonic)
  // 5. Triggers mnemonic backup download
  async setupEncryption(apiBaseUrl, authToken) {
    const mnemonic = this.generateMnemonic();
    const hexKey   = await this.deriveKeyFromMnemonic(mnemonic);
    this.saveKeyLocally(hexKey);

    const response = await fetch(`${apiBaseUrl}/api/privacy/setup`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({ mnemonic }), // server derives key+hash from this
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Failed to set up encryption");
    }

    this.downloadMnemonic(mnemonic); // must prompt user to save this
    return { mnemonic, hexKey };
  }

  // ── RECOVERY FLOW (new device / cleared browser) ───────────────────────────
  // User re-enters their 12 words → same key re-derived → all data readable again
  async restoreFromMnemonic(mnemonic, apiBaseUrl, authToken) {
    if (!this.validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic phrase. Check your 12 words and try again.");
    }

    const hexKey = await this.deriveKeyFromMnemonic(mnemonic);

    // Verify phrase against server hash (confirms correct phrase before saving)
    const response = await fetch(`${apiBaseUrl}/api/privacy/verify`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({ mnemonic }),
    });

    if (response.ok) {
      const data = await response.json();
      if (!data.valid) {
        throw new Error("Phrase does not match. This is not the phrase that was used to set up encryption.");
      }
    }

    this.saveKeyLocally(hexKey);
    return { hexKey };
  }

  // ── Download mnemonic as backup file ──────────────────────────────────────
  downloadMnemonic(mnemonic) {
    const content = [
      "SKYUP CRM — ENCRYPTION RECOVERY PHRASE",
      "═══════════════════════════════════════",
      "",
      "Your 12-word recovery phrase:",
      "",
      mnemonic,
      "",
      "═══════════════════════════════════════",
      "⚠️  KEEP THIS SAFE — TREAT LIKE A PASSWORD",
      "",
      "• These 12 words are the ONLY way to access your encrypted data",
      "• Lost device or cleared browser? Re-enter these words to recover",
      "• Anyone with these words can decrypt your lead data — keep private",
      "• Store in a password manager, or print and lock away safely",
      "",
      "HOW TO RECOVER:",
      "  1. Go to your CRM login",
      '  2. Click "Restore encryption key"',
      "  3. Enter these 12 words in order",
      "  4. Full data access is restored",
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "skyup-crm-recovery-phrase.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default CRMEncryption;