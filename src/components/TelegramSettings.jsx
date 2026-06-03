// src/components/TelegramSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Company-level Telegram settings as an icon button + popover.
// Shown in the Admin/SuperAdmin Dashboard header.
//
// A green dot on the icon = admin chat ID is already configured.
//
// Backend expected:
//   GET  /admin/company/telegram      → { telegramAdminChatId }
//   PUT  /admin/company/telegram      → { telegramBotToken?, telegramAdminChatId }
//   POST /admin/company/telegram/test → sends a test message to adminChatId
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import api from "../data/axiosConfig";

const TelegramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

export default function TelegramSettings() {
  const [open,       setOpen]      = useState(false);
  const [chatId,     setChatId]    = useState("");
  const [draftChat,  setDraftChat] = useState("");
  const [draftToken, setDraftToken]= useState("");
  const [showToken,  setShowToken] = useState(false);
  const [saving,     setSaving]    = useState(false);
  const [testing,    setTesting]   = useState(false);
  const [msg,        setMsg]       = useState({ type: "", text: "" });

  const popoverRef = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => {
    api.get("/admin/company/telegram")
      .then((res) => {
        const id = res.data?.telegramAdminChatId || "";
        setChatId(id);
        setDraftChat(id);
      })
      .catch(() => {});
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick  = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false); };
    const onKey    = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80); }, [open]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { telegramAdminChatId: draftChat.trim() };
      if (draftToken.trim()) payload.telegramBotToken = draftToken.trim();
      await api.put("/admin/company/telegram", payload);
      setChatId(draftChat.trim());
      setDraftToken("");
      flash("ok", "✓ Saved!");
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/admin/company/telegram/test");
      flash("ok", "✓ Test sent! Check Telegram.");
    } catch (e) {
      flash("err", "Test failed — check token & chat ID.");
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = !!chatId;

  return (
    <div className="relative" ref={popoverRef}>
      {/* ── Trigger icon ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Telegram Notifications"
        className={`relative p-2 rounded-xl border transition-all duration-150 focus:outline-none
          ${open
            ? "bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400"
            : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] hover:text-sky-500 hover:border-sky-300 dark:hover:border-sky-700 dark:hover:text-sky-400"
          }`}
      >
        <TelegramIcon className="w-4 h-4" />
        {isConfigured && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1A1D27]" />
        )}
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#1A1D27]
            border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-xl z-50 overflow-hidden"
          style={{ animation: "tgSlide 0.15s ease both" }}
        >
          <style>{`
            @keyframes tgSlide {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-[#F3F4F6] dark:border-[#262A38]">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
              <TelegramIcon className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Telegram Notifications</p>
              <p className="text-[10px] text-[#8B92A9]">Company-wide lead alerts</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-5 h-5 flex items-center justify-center rounded-lg text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262A38] transition"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Setup hint */}
            <div className="px-2.5 py-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30">
              <p className="text-[10px] text-sky-700 dark:text-sky-300 leading-relaxed">
                Create a bot via <span className="font-mono font-bold">@BotFather</span>, add it to your group, then get the chat ID via <span className="font-mono font-bold">@userinfobot</span>.
              </p>
            </div>

            {/* Bot Token */}
            <div>
              <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                Bot Token
                <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">(leave blank to keep existing)</span>
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showToken ? "text" : "password"}
                  value={draftToken}
                  onChange={(e) => setDraftToken(e.target.value)}
                  placeholder="7123456789:AAHxxxxxxxx"
                  className="w-full px-3 py-2 pr-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                    bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
                    placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] font-mono transition"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#2563EB] transition"
                >
                  {showToken
                    ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.126-3.343M9.88 9.88a3 3 0 104.243 4.243M6.343 6.343A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.21 5.152M3 3l18 18"/></svg>
                    : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Admin Chat ID */}
            <div>
              <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                Admin Chat ID
                {isConfigured && (
                  <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● connected</span>
                )}
              </label>
              <input
                type="text"
                value={draftChat}
                onChange={(e) => setDraftChat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                placeholder="-1001234567890"
                className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                  bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
                  placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] font-mono transition"
              />
              <p className="text-[10px] text-[#8B92A9] mt-1">Group ID (negative) or personal chat ID</p>
            </div>

            {/* Feedback */}
            {msg.text && (
              <p className={`text-[11px] font-medium ${msg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
                {msg.text}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-0.5">
              <button
                onClick={handleSave}
                disabled={saving || (!draftChat.trim() && !draftToken.trim())}
                className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50
                  text-white text-[12px] font-semibold transition flex items-center justify-center gap-1.5"
              >
                {saving
                  ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                }
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={handleTest}
                disabled={testing || !chatId}
                title={!chatId ? "Save a Chat ID first" : "Send a test message"}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                  text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
                  hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400
                  disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                {testing
                  ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                }
                Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
