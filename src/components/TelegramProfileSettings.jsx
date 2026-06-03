// src/components/TelegramProfileSettings.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import { getRole } from "../data/dataService";

const TelegramIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

export default function TelegramProfileSettings() {
  const role      = getRole();
  const isAdmin   = role === "admin" || role === "superadmin";
  const baseRoute = isAdmin ? "/admin" : "/user";

  const [open,    setOpen]    = useState(false);
  const [chatId,  setChatId]  = useState("");
  const [draft,   setDraft]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg,     setMsg]     = useState({ type: "", text: "" });

  const btnRef     = useRef(null);
  const popoverRef = useRef(null);
  const inputRef   = useRef(null);

  const [popoverStyle, setPopoverStyle] = useState({});

  // Load saved Chat ID once
  useEffect(() => {
    api.get(`${baseRoute}/profile`)
      .then((res) => {
        const id = res.data?.telegramChatId || "";
        setChatId(id);
        setDraft(id);
      })
      .catch(() => {});
  }, [baseRoute]);

  // ✅ FIXED: Opens BELOW the button using top instead of bottom
  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPopoverStyle({
      position: "fixed",
      top: rect.bottom + 8,              // ← below the button
      right: window.innerWidth - rect.right,
      zIndex: 9999,
      width: 288,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        btnRef.current    && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const keyHandler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  // Focus input when popover opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`${baseRoute}/profile`, { telegramChatId: draft.trim() });
      setChatId(draft.trim());
      flash("ok", "✓ Chat ID saved!");
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post(`${baseRoute}/telegram/test`);
      flash("ok", "✓ Test sent! Check Telegram.");
    } catch (e) {
      flash("err", "Test failed — check Chat ID.");
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = !!chatId;
  const isDirty      = draft.trim() !== chatId;

  const popoverContent = (
    <div
      ref={popoverRef}
      style={{ ...popoverStyle, animation: "tgSlideDown 0.15s ease both" }}
      className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-xl overflow-hidden"
    >
      {/* ✅ FIXED: slide down animation instead of slide up */}
      <style>{`
        @keyframes tgSlideDown {
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
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Telegram Alerts</p>
          <p className="text-[10px] text-[#8B92A9]">Get notified when a lead is assigned to you</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-5 h-5 flex items-center justify-center rounded-lg text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] hover:bg-gray-100 dark:hover:bg-[#262A38] transition"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Hint */}
        <div className="px-2.5 py-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30">
          <p className="text-[10px] text-sky-700 dark:text-sky-300 leading-relaxed">
            Message <span className="font-mono font-bold">@userinfobot</span> on Telegram to get your personal Chat ID, then paste it below.
          </p>
        </div>

        {/* Input */}
        <div>
          <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
            Your Chat ID
            {isConfigured && !isDirty && (
              <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● connected</span>
            )}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            placeholder="e.g. 987654321"
            className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
              bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA]
              placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] font-mono transition"
          />
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
            disabled={saving || !draft.trim()}
            className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50
              text-white text-[12px] font-semibold transition flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            )}
            {saving ? "Saving…" : "Save"}
          </button>

          <button
            onClick={handleTest}
            disabled={testing || !chatId}
            title={!chatId ? "Save your Chat ID first" : "Send a test message"}
            className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
              text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
              hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400
              disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
          >
            {testing ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            )}
            Test
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Trigger icon button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title="Telegram Notifications"
        className={`relative w-8 h-8 rounded-xl flex items-center justify-center transition-all
          ${open
            ? "bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400"
            : "bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-gray-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-500 dark:hover:text-sky-400"
          }`}
      >
        <TelegramIcon className="w-4 h-4" />
        {/* Green dot — Chat ID is saved */}
        {isConfigured && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white dark:border-[#1A1D27]" />
        )}
      </button>

      {/* Popover rendered into document.body via portal */}
      {open && createPortal(popoverContent, document.body)}
    </div>
  );
}
