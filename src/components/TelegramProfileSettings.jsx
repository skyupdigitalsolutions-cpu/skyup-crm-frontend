// src/components/TelegramProfileSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Employee / Admin personal Telegram settings.
// Lets each user save their personal Telegram Chat ID so they get a direct
// message whenever a lead is assigned specifically to them.
//
// This component works for both "user" and "admin" roles — it auto-detects
// the correct endpoint from the user's role stored in localStorage.
//
// Backend expected (user role):
//   GET  /user/profile                  → { name, email, telegramChatId, ... }
//   PUT  /user/profile                  → { telegramChatId }
//   POST /user/telegram/test            → sends a test message to the user's chatId
//
// Backend expected (admin role):
//   GET  /admin/profile                 → { name, email, telegramChatId, ... }
//   PUT  /admin/profile                 → { telegramChatId }
//   POST /admin/telegram/test           → sends a test message to the admin's chatId
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";
import { getRole } from "../data/dataService";

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition font-mono";
const LABEL_CLS = "block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5";
const HINT_CLS  = "text-[10px] text-[#8B92A9] mt-1 leading-relaxed";

export default function TelegramProfileSettings() {
  const role      = getRole(); // "user" | "admin" | "superadmin"
  const isAdmin   = role === "admin" || role === "superadmin";
  const baseRoute = isAdmin ? "/admin" : "/user";

  const [chatId,  setChatId]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error,   setError]   = useState("");

  useEffect(() => {
    api.get(`${baseRoute}/profile`)
      .then((res) => setChatId(res.data?.telegramChatId || ""))
      .catch(() => {});
  }, [baseRoute]);

  const flash = (type, msg) => {
    if (type === "ok") { setSuccess(msg); setError(""); setTimeout(() => setSuccess(""), 4000); }
    else               { setError(msg);   setSuccess(""); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${baseRoute}/profile`, { telegramChatId: chatId.trim() });
      flash("ok", "✓ Your Telegram Chat ID saved! You'll now receive personal lead assignment alerts.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save Telegram Chat ID.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!chatId.trim()) { flash("err", "Enter your Chat ID first."); return; }
    setTesting(true);
    try {
      await api.post(`${baseRoute}/telegram/test`);
      flash("ok", "✓ Test message sent! Check your personal Telegram.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Test failed — check your Chat ID and make sure you've started the company bot.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Personal Telegram Alerts</h3>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Get notified directly when a lead is assigned to you</p>
        </div>
      </div>

      {/* How to get chat ID */}
      <div className="mb-4 px-3 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-900/15 border border-sky-100 dark:border-sky-800/40">
        <p className="text-[11px] text-sky-700 dark:text-sky-300 leading-relaxed">
          <span className="font-semibold">How to get your Chat ID:</span> Open Telegram → message{" "}
          <span className="font-mono font-bold">@userinfobot</span> → it instantly replies with your personal Chat ID.
          Then start a chat with your company's bot so it can message you.
        </p>
      </div>

      {/* Chat ID input */}
      <div className="mb-4">
        <label className={LABEL_CLS}>Your Personal Telegram Chat ID</label>
        <input
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="e.g. 987654321"
          className={FIELD_CLS}
        />
        <p className={HINT_CLS}>
          This is your personal ID — different from a group ID. Always a positive number for personal chats.
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-[12px] text-emerald-600 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition flex items-center justify-center gap-2"
        >
          {saving && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {saving ? "Saving…" : "Save Chat ID"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !chatId.trim()}
          title={!chatId.trim() ? "Enter your Chat ID first" : "Send a test message to yourself"}
          className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
        >
          {testing ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
          )}
          {testing ? "Sending…" : "Test"}
        </button>
      </div>
    </div>
  );
}
