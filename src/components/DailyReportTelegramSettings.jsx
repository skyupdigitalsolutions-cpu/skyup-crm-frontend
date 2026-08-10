// src/components/DailyReportTelegramSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin settings panel for the Daily Telegram Performance Report.
// Completely independent from TelegramSettings.jsx (campaign notifications).
//
// Rendered as a popover in the CompanyHeader — same pattern as TelegramSettings.
//
// APIs consumed:
//   GET  /daily-report/settings   → load config (bot token always masked)
//   PUT  /daily-report/settings   → save config
//   POST /daily-report/test       → send test report now
//   POST /daily-report/send-now   → send today's report immediately
//   GET  /daily-report/history    → last 30 execution records
//
// Security:
//   • Bot token never returned by API — shown as "•••" placeholder.
//   • Only sent to backend when user types a new value (not masked placeholder).
//   • Admin-only (protectAdmin middleware on all backend routes).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../data/axiosConfig";
import {
  BarChart2, X, Eye, EyeOff, CheckCircle2, AlertCircle,
  Loader2, Save, ToggleLeft, ToggleRight, Send,
  Clock, Globe, History, ChevronRight, RefreshCw,
} from "lucide-react";

// ── Panel position (same viewport-clamped pattern as TelegramSettings) ────────
const PANEL_WIDTH  = 360;
const PANEL_MARGIN = 8;

function getPanelStyle(btnRef) {
  if (!btnRef.current) return {};
  const rect = btnRef.current.getBoundingClientRect();
  const vw   = window.innerWidth;
  let left   = rect.right - PANEL_WIDTH;
  left = Math.max(PANEL_MARGIN, left);
  left = Math.min(left, vw - PANEL_WIDTH - PANEL_MARGIN);
  return {
    position: "fixed",
    top:      rect.bottom + 8,
    left,
    width:    Math.min(PANEL_WIDTH, vw - PANEL_MARGIN * 2),
    zIndex:   9999,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Feedback({ msg }) {
  if (!msg?.text) return null;
  return (
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
  );
}

function StatusBadge({ status }) {
  const styles = {
    sent:    "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    failed:  "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    skipped: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
    pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

// ── Common timezones for dropdown ─────────────────────────────────────────────
const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Bangkok",
  "Asia/Kuala_Lumpur",
  "Asia/Jakarta",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [sendingNow,  setSendingNow]  = useState(false);
  const [showToken,   setShowToken]   = useState(false);
  const [msg,         setMsg]         = useState({ type: "", text: "" });

  // Saved state (from server)
  const [saved, setSaved] = useState(null);

  // Draft state (user edits)
  const [draft, setDraft] = useState({
    enabled:         false,
    telegramBotToken:"",
    telegramChatId:  "",
    reportTime:      "19:00",
    timezone:        "Asia/Kolkata",
    sendEmptyReport: false,
  });

  const flash = useCallback((type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get("/daily-report/settings")
      .then(res => {
        const d = res.data || {};
        const s = {
          enabled:         d.enabled         || false,
          telegramBotToken:d.telegramBotToken || "",
          telegramChatId:  d.telegramChatId  || "",
          reportTime:      d.reportTime      || "19:00",
          timezone:        d.timezone        || "Asia/Kolkata",
          sendEmptyReport: d.sendEmptyReport || false,
          configured:      d.configured      || false,
        };
        setSaved(s);
        setDraft({ ...s, telegramBotToken: "" }); // never pre-fill token field
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));

  const hasChanges = saved && (
    draft.enabled         !== saved.enabled         ||
    draft.telegramChatId  !== saved.telegramChatId  ||
    draft.reportTime      !== saved.reportTime       ||
    draft.timezone        !== saved.timezone         ||
    draft.sendEmptyReport !== saved.sendEmptyReport  ||
    draft.telegramBotToken.trim() !== ""             // any token input = change
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        enabled:         draft.enabled,
        telegramChatId:  draft.telegramChatId.trim(),
        reportTime:      draft.reportTime,
        timezone:        draft.timezone,
        sendEmptyReport: draft.sendEmptyReport,
      };
      // Only include token if user typed a real value
      if (draft.telegramBotToken.trim() && !draft.telegramBotToken.includes("•")) {
        payload.telegramBotToken = draft.telegramBotToken.trim();
      }
      await api.put("/daily-report/settings", payload);
      setSaved(prev => ({
        ...prev,
        ...payload,
        configured: !!(payload.telegramBotToken || prev?.configured) && !!payload.telegramChatId,
      }));
      setDraft(prev => ({ ...prev, telegramBotToken: "" }));
      flash("ok", "Settings saved!");
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/daily-report/test");
      flash("ok", "Test report sent! Check your Telegram chat.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Test failed — check Bot Token and Chat ID.");
    } finally { setTesting(false); }
  };

  const handleSendNow = async () => {
    setSendingNow(true);
    try {
      const res = await api.post("/daily-report/send-now");
      if (res.data?.skipped) flash("ok", "Report already sent for today.");
      else flash("ok", "Today's report sent successfully!");
    } catch (e) {
      flash("err", e.response?.data?.message || "Send failed.");
    } finally { setSendingNow(false); }
  };

  const isConfigured = saved?.configured;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Info banner */}
      <div className="px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
        <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
          Sends a daily employee performance summary to a Telegram chat —
          leads, calls, follow-ups, and conversions per employee.
          Completely separate from campaign lead notifications.
        </p>
      </div>

      {/* Enable toggle */}
      <button
        type="button"
        onClick={() => set("enabled", !draft.enabled)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors
          ${draft.enabled
            ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]"
          }`}
      >
        <div className="text-left">
          <p className={`text-[12px] font-semibold ${draft.enabled ? "text-emerald-700 dark:text-emerald-400" : "text-[#0F1117] dark:text-[#F0F2FA]"}`}>
            {draft.enabled ? "Daily Report enabled" : "Daily Report disabled"}
          </p>
          <p className="text-[10px] text-[#8B92A9]">
            {draft.enabled ? "Report will be sent at the configured time" : "No reports will be sent"}
          </p>
        </div>
        {draft.enabled
          ? <ToggleRight className="w-5 h-5 text-emerald-500 shrink-0" />
          : <ToggleLeft  className="w-5 h-5 text-[#C4C9D9] dark:text-[#3E4257] shrink-0" />
        }
      </button>

      {/* Bot Token */}
      <div>
        <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
          Telegram Bot Token
          {saved?.configured
            ? <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● set — leave blank to keep</span>
            : <span className="ml-1.5 text-[10px] font-normal text-amber-500">● not set</span>
          }
        </label>
        <div className="relative">
          <input
            type={showToken ? "text" : "password"}
            value={draft.telegramBotToken}
            onChange={e => set("telegramBotToken", e.target.value)}
            placeholder={saved?.configured ? "Enter new token to replace…" : "7123456789:AAHxxxxxxxx"}
            className="w-full px-3 py-2 pr-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
              bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
              placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] font-mono transition"
          />
          <button
            type="button"
            onClick={() => setShowToken(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#2563EB] transition"
          >
            {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[10px] text-[#8B92A9] mt-1">
          Create a <strong>separate</strong> bot for daily reports via <span className="font-mono font-semibold">@BotFather</span>
        </p>
      </div>

      {/* Chat ID */}
      <div>
        <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
          Telegram Chat ID
          {saved?.telegramChatId && <span className="ml-1.5 text-[10px] font-normal text-emerald-500">● connected</span>}
        </label>
        <input
          type="text"
          value={draft.telegramChatId}
          onChange={e => set("telegramChatId", e.target.value)}
          placeholder="-1001234567890"
          className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
            bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
            placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] font-mono transition"
        />
        <p className="text-[10px] text-[#8B92A9] mt-1">
          Add bot to group → get ID via <span className="font-mono font-semibold">@userinfobot</span>
        </p>
      </div>

      {/* Report Time */}
      <div>
        <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
          <Clock className="w-3 h-3 inline mr-1" />Report Time
        </label>
        <input
          type="time"
          value={draft.reportTime}
          onChange={e => set("reportTime", e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
            bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
            focus:outline-none focus:border-[#2563EB] transition"
        />
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
          <Globe className="w-3 h-3 inline mr-1" />Timezone
        </label>
        <select
          value={draft.timezone}
          onChange={e => set("timezone", e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
            bg-[#F8F9FC] dark:bg-[#13161E] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
            focus:outline-none focus:border-[#2563EB] transition"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Send empty report toggle */}
      <button
        type="button"
        onClick={() => set("sendEmptyReport", !draft.sendEmptyReport)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border transition-colors
          ${draft.sendEmptyReport
            ? "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10"
            : "border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]"
          }`}
      >
        <div className="text-left">
          <p className="text-[11px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
            Send empty report
          </p>
          <p className="text-[10px] text-[#8B92A9]">
            {draft.sendEmptyReport
              ? "Report sent even when no activity today"
              : "Skip report if no activity today"
            }
          </p>
        </div>
        {draft.sendEmptyReport
          ? <ToggleRight className="w-4 h-4 text-sky-500 shrink-0" />
          : <ToggleLeft  className="w-4 h-4 text-[#C4C9D9] dark:text-[#3E4257] shrink-0" />
        }
      </button>

      <Feedback msg={msg} />

      {/* Save + Test */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50
            text-white text-[12px] font-semibold transition flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || !isConfigured}
          title={!isConfigured ? "Save Bot Token and Chat ID first" : "Send test report now"}
          className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
            text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
            hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400
            disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
        >
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Test
        </button>
      </div>

      {/* Send Now */}
      {isConfigured && (
        <button
          onClick={handleSendNow}
          disabled={sendingNow}
          className="w-full py-2 rounded-xl border border-indigo-200 dark:border-indigo-700
            text-indigo-600 dark:text-indigo-400 text-[12px] font-semibold
            hover:bg-indigo-50 dark:hover:bg-indigo-900/20
            disabled:opacity-50 transition flex items-center justify-center gap-1.5"
        >
          {sendingNow
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />
          }
          {sendingNow ? "Sending…" : "Send Report Now"}
        </button>
      )}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/daily-report/history")
      .then(res => setHistory(res.data?.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" />
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-[#8B92A9]">
        <History className="w-7 h-7 opacity-30" />
        <p className="text-[12px]">No reports sent yet.</p>
        <p className="text-[10px] text-center px-4">
          Configure the settings and save to start receiving daily reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
      {history.map((entry, i) => (
        <div
          key={entry._id || i}
          className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]
            rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                {entry.reportDate}
              </p>
              <StatusBadge status={entry.status} />
              {entry.triggeredBy === "manual" && (
                <span className="text-[9px] text-[#8B92A9] italic">manual</span>
              )}
              {entry.triggeredBy === "test" && (
                <span className="text-[9px] text-[#8B92A9] italic">test</span>
              )}
            </div>
            <p className="text-[10px] text-[#8B92A9] truncate">
              {entry.employeeCount > 0
                ? `${entry.employeeCount} employee${entry.employeeCount !== 1 ? "s" : ""} · ${entry.scheduledTime || "—"} ${entry.timezone || ""}`
                : entry.status === "skipped"
                ? "No activity — skipped"
                : entry.errorMessage || "—"
              }
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#C4C9D9] dark:text-[#3E4257] shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DailyReportTelegramSettings() {
  const [open,       setOpen]       = useState(false);
  const [activeTab,  setActiveTab]  = useState("settings");
  const [panelStyle, setPanelStyle] = useState({});
  const [dotData,    setDotData]    = useState({ enabled: false, configured: false });

  const btnRef   = useRef(null);
  const panelRef = useRef(null);

  // Refresh status dot on open/close
  useEffect(() => {
    api.get("/daily-report/settings")
      .then(res => {
        const d = res.data || {};
        setDotData({ enabled: d.enabled || false, configured: d.configured || false });
      })
      .catch(() => {});
  }, [open]);

  // Recompute panel position on open / resize / scroll
  useEffect(() => {
    if (!open) return;
    const update = () => setPanelStyle(getPanelStyle(btnRef));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown",   onKey);
    };
  }, [open]);

  const TABS = [
    { id: "settings", label: "Settings", icon: BarChart2 },
    { id: "history",  label: "History",  icon: History   },
  ];

  const panel = open ? (
    <div
      ref={panelRef}
      style={{ ...panelStyle, animation: "drSlide 0.15s ease both" }}
      className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-xl overflow-hidden"
    >
      <style>{`
        @keyframes drSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-[#F3F4F6] dark:border-[#262A38]">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
          <BarChart2 className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Daily Report</p>
          <p className="text-[10px] text-[#8B92A9]">Employee performance · Telegram delivery</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[#8B92A9]
            hover:text-[#0F1117] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262A38] transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-3 pb-0">
        {TABS.map(tab => {
          const Icon   = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold
                border transition flex-1 justify-center
                ${active
                  ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                  : "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:border-[#CBD5E1] dark:hover:border-[#3E4257] hover:text-[#4B5168] dark:hover:text-[#9DA3BB]"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-4 py-3 max-h-[520px] overflow-y-auto">
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "history"  && <HistoryTab />}
      </div>
    </div>
  ) : null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        title="Daily Telegram Report"
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-150 focus:outline-none
          ${open
            ? "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
            : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
          }`}
      >
        <BarChart2 className="w-3.5 h-3.5" />
        {dotData.configured && (
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-[#1A1D27]
            ${dotData.enabled ? "bg-emerald-500" : "bg-amber-400"}`}
          />
        )}
      </button>

      {panel && createPortal(panel, document.body)}
    </div>
  );
}
