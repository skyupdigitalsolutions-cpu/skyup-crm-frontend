// src/components/TelegramSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Company-level Telegram notification settings (campaign leads only).
// Shown in the Admin/SuperAdmin Dashboard header as an icon button + popover.
//
// Backend API (now implemented):
//   GET  /admin/company/telegram      → { telegramEnabled, telegramChatId, hasToken }
//   PUT  /admin/company/telegram      → { telegramBotToken?, telegramChatId, telegramEnabled }
//   POST /admin/company/telegram/test → sends a test message
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import api from "../data/axiosConfig";
import {
  Send,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ToggleLeft,
  ToggleRight,
  Lock,
} from "lucide-react";

// Campaign sources that trigger notifications — mirrors telegramService.js
const CAMPAIGN_SOURCES = ["Meta (Facebook/Instagram)", "Google Ads", "Website/Landing Page"];

export default function TelegramSettings() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [open,         setOpen]        = useState(false);
  const [loading,      setLoading]     = useState(true);

  // Saved (server) values
  const [chatId,       setChatId]      = useState("");
  const [hasToken,     setHasToken]    = useState(false);
  const [enabled,      setEnabled]     = useState(false);

  // Draft (form) values
  const [draftChat,    setDraftChat]   = useState("");
  const [draftToken,   setDraftToken]  = useState("");
  const [draftEnabled, setDraftEnabled]= useState(false);

  const [showToken,  setShowToken]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [msg,        setMsg]        = useState({ type: "", text: "" });

  const popoverRef = useRef(null);
  const inputRef   = useRef(null);

  // ── Load config on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    api.get("/admin/company/telegram")
      .then((res) => {
        const d = res.data || {};
        const id  = d.telegramChatId  || "";
        const tok = d.hasToken        || false;
        const en  = d.telegramEnabled || false;
        setChatId(id);    setDraftChat(id);
        setHasToken(tok);
        setEnabled(en);   setDraftEnabled(en);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Close on outside click / Escape ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // ── Flash feedback ────────────────────────────────────────────────────────
  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draftChat.trim() && !draftToken.trim() && draftEnabled === enabled) return;
    setSaving(true);
    try {
      const payload = {
        telegramChatId:  draftChat.trim(),
        telegramEnabled: draftEnabled,
      };
      if (draftToken.trim()) payload.telegramBotToken = draftToken.trim();
      await api.put("/admin/company/telegram", payload);
      setChatId(draftChat.trim());
      setEnabled(draftEnabled);
      if (draftToken.trim()) setHasToken(true);
      setDraftToken("");
      flash("ok", "Saved!");
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Test ──────────────────────────────────────────────────────────────────
  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/admin/company/telegram/test");
      flash("ok", "Test sent! Check your Telegram group.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Test failed — check token & chat ID.");
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = !!chatId && hasToken;
  const hasChanges   = draftChat !== chatId || draftToken.trim() !== "" || draftEnabled !== enabled;

  return (
    <div className="relative" ref={popoverRef}>

      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Telegram Notifications"
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-150 focus:outline-none
          ${open
            ? "bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400"
            : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] hover:text-sky-500 hover:border-sky-300 dark:hover:border-sky-700 dark:hover:text-sky-400"
          }`}
      >
        <Send className="w-3.5 h-3.5" />
        {/* Status dot */}
        {isConfigured && (
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-[#1A1D27]
            ${enabled ? "bg-emerald-500" : "bg-amber-400"}`}
          />
        )}
      </button>

      {/* ── Popover ── */}
      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-[340px] bg-white dark:bg-[#1A1D27]
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
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-sky-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Telegram Notifications</p>
              <p className="text-[10px] text-[#8B92A9]">Campaign leads only · company-isolated</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262A38] transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" />
            </div>
          ) : (
            <div className="px-4 py-3 space-y-3">

              {/* ── Campaign sources info ── */}
              <div className="px-3 py-2.5 rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30">
                <p className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 mb-1.5">
                  Notifies for campaign leads only:
                </p>
                <div className="flex flex-wrap gap-1">
                  {CAMPAIGN_SOURCES.map(s => (
                    <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-800/40 text-sky-700 dark:text-sky-300 font-medium">
                      {s}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-1.5">
                  Manual entries, CSV imports, bulk uploads — never notified.
                </p>
              </div>

              {/* ── Enable / disable toggle ── */}
              <button
                type="button"
                onClick={() => setDraftEnabled(v => !v)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors
                  ${draftEnabled
                    ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10"
                    : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]"
                  }`}
              >
                <div className="text-left">
                  <p className={`text-[12px] font-semibold ${draftEnabled ? "text-emerald-700 dark:text-emerald-400" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
                    {draftEnabled ? "Notifications enabled" : "Notifications paused"}
                  </p>
                  <p className="text-[10px] text-[#8B92A9]">
                    {draftEnabled ? "Campaign leads will be sent to Telegram" : "No messages will be sent"}
                  </p>
                </div>
                {draftEnabled
                  ? <ToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
                  : <ToggleLeft  className="w-5 h-5 text-[#C4C9D9] dark:text-[#3E4257] shrink-0" />
                }
              </button>

              {/* ── Bot Token ── */}
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                  Bot Token
                  {hasToken
                    ? <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● set — leave blank to keep</span>
                    : <span className="ml-1.5 text-[10px] font-normal text-amber-500">● not set</span>
                  }
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showToken ? "text" : "password"}
                    value={draftToken}
                    onChange={(e) => setDraftToken(e.target.value)}
                    placeholder={hasToken ? "Enter new token to replace…" : "7123456789:AAHxxxxxxxx"}
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
                      ? <EyeOff className="w-3.5 h-3.5" />
                      : <Eye    className="w-3.5 h-3.5" />
                    }
                  </button>
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  Create via <span className="font-mono font-semibold">@BotFather</span> on Telegram
                </p>
              </div>

              {/* ── Chat ID ── */}
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                  Group Chat ID
                  {chatId && <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● connected</span>}
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
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  Add bot to group → get ID via <span className="font-mono font-semibold">@userinfobot</span>
                </p>
              </div>

              {/* ── Feedback ── */}
              {msg.text && (
                <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium
                  ${msg.type === "ok"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                  }`}
                >
                  {msg.type === "ok"
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    : <AlertCircle  className="w-3.5 h-3.5 shrink-0" />
                  }
                  {msg.text}
                </div>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50
                    text-white text-[12px] font-semibold transition flex items-center justify-center gap-1.5"
                >
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Save    className="w-3.5 h-3.5" />
                  }
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing || !isConfigured}
                  title={!isConfigured ? "Save bot token and chat ID first" : "Send a test message to the group"}
                  className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                    text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
                    hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400
                    disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                >
                  {testing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Send    className="w-3 h-3" />
                  }
                  Test
                </button>
              </div>

              {/* ── Lock hint when not configured ── */}
              {!isConfigured && (
                <p className="flex items-center gap-1.5 text-[10px] text-[#8B92A9] justify-center pb-0.5">
                  <Lock className="w-3 h-3" />
                  Add bot token + chat ID, then save to activate
                </p>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Company-level Telegram notification settings (campaign leads only).
// Shown in the Admin/SuperAdmin Dashboard header as an icon button + popover.
//
// Backend API (now implemented):
//   GET  /admin/company/telegram      → { telegramEnabled, telegramChatId, hasToken }
//   PUT  /admin/company/telegram      → { telegramBotToken?, telegramChatId, telegramEnabled }
