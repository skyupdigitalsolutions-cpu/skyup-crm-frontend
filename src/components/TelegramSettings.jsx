// src/components/TelegramSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin / Admin panel to configure company-level Telegram notifications.
//
// Each company sets:
//   • telegramBotToken     — created via @BotFather on Telegram
//   • telegramAdminChatId  — group or personal chat ID that receives ALL lead alerts
//
// Backend expected:
//   GET  /admin/company/telegram          → { telegramAdminChatId }
//                                           (token is select:false — never returned)
//   PUT  /admin/company/telegram          → { telegramBotToken, telegramAdminChatId }
//   POST /admin/company/telegram/test     → sends a test message to adminChatId
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition font-mono";

const LABEL_CLS = "block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5";
const HINT_CLS  = "text-[10px] text-[#8B92A9] mt-1 leading-relaxed";

export default function TelegramSettings() {
  const [botToken,   setBotToken]   = useState("");
  const [chatId,     setChatId]     = useState("");
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [success,    setSuccess]    = useState("");
  const [error,      setError]      = useState("");
  const [showToken,  setShowToken]  = useState(false);

  // Load existing config on mount (token is write-only from server — only chatId returns)
  useEffect(() => {
    api.get("/admin/company/telegram")
      .then((res) => {
        setChatId(res.data?.telegramAdminChatId || "");
      })
      .catch(() => {});
  }, []);

  const flash = (type, msg) => {
    if (type === "ok") { setSuccess(msg); setError(""); setTimeout(() => setSuccess(""), 4000); }
    else               { setError(msg);   setSuccess(""); }
  };

  const handleSave = async () => {
    if (!botToken && !chatId) { flash("err", "Enter at least the Bot Token or Admin Chat ID."); return; }
    setSaving(true);
    try {
      const payload = { telegramAdminChatId: chatId.trim() };
      if (botToken.trim()) payload.telegramBotToken = botToken.trim();
      await api.put("/admin/company/telegram", payload);
      setBotToken(""); // clear token field after save (it's write-only)
      flash("ok", "✓ Telegram settings saved! Notifications will now go to this company's bot.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Failed to save Telegram settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/admin/company/telegram/test");
      flash("ok", "✓ Test message sent! Check your Telegram group/chat.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Test failed — check your bot token and chat ID.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 max-w-lg mt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
          {/* Telegram paper plane icon */}
          <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Telegram Notifications</h3>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">
            Get instant alerts in Telegram whenever a new lead comes in
          </p>
        </div>
      </div>

      {/* Setup guide */}
      <div className="mb-5 px-3 py-3 rounded-xl bg-sky-50 dark:bg-sky-900/15 border border-sky-100 dark:border-sky-800/40">
        <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-400 mb-1.5">Quick Setup (2 steps)</p>
        <ol className="text-[11px] text-sky-700 dark:text-sky-300 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Message <span className="font-mono font-bold">@BotFather</span> on Telegram → create a new bot → copy the bot token below.</li>
          <li>Add the bot to your team group (or message it directly), then message <span className="font-mono font-bold">@userinfobot</span> to get your Chat ID.</li>
        </ol>
      </div>

      {/* Bot Token */}
      <div className="mb-4">
        <label className={LABEL_CLS}>
          Bot Token <span className="text-red-500">*</span>
          <span className="text-[10px] font-normal text-[#8B92A9] ml-1">(write-only — leave blank to keep existing)</span>
        </label>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="7123456789:AAHxxxxxxxxxxxxxxx"
            className={FIELD_CLS + " pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowToken((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#2563EB] transition"
            title={showToken ? "Hide" : "Show"}
          >
            {showToken ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.126-3.343M9.88 9.88a3 3 0 104.243 4.243M6.343 6.343A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.21 5.152M3 3l18 18"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
            )}
          </button>
        </div>
        <p className={HINT_CLS}>From @BotFather → /newbot → API token</p>
      </div>

      {/* Admin Chat ID */}
      <div className="mb-5">
        <label className={LABEL_CLS}>
          Admin Chat ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="-1001234567890  or  123456789"
          className={FIELD_CLS}
        />
        <p className={HINT_CLS}>
          Group chat ID (negative number, e.g. -1001234567890) or personal chat ID.<br/>
          Get it by messaging <span className="font-mono">@userinfobot</span> on Telegram.
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
          {saving ? "Saving…" : "Save Settings"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || (!chatId)}
          title={!chatId ? "Enter Admin Chat ID first" : "Send a test message"}
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

      <p className={HINT_CLS + " mt-3"}>
        Every new lead will trigger a notification to this chat. Individual employees can also add their personal Telegram Chat ID in their profile to receive personal assignment alerts.
      </p>
    </div>
  );
}
