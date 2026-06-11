// src/components/TelegramSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Telegram notification settings — two-tier:
//
//  TAB 1 — "Company Group"
//    Shared group chat for all campaign leads → company.telegramChatId
//    Only super_admin can edit bot token; both admin roles can toggle/test.
//
//  TAB 2 — "Admin Alerts" (super_admin only)
//    Each admin in the company gets their own personal chat ID + on/off toggle.
//    When a campaign lead arrives, EVERY admin with a configured chat ID
//    receives a personal notification (via the company's shared bot token).
//
// Backend APIs:
//   GET  /admin/company/telegram                     → company-level config
//   PUT  /admin/company/telegram                     → save company config
//   POST /admin/company/telegram/test                → test company group
//   GET  /admin/company/telegram/admins              → list admins + their config
//   PUT  /admin/company/telegram/admins/:id          → save one admin's config
//   POST /admin/company/telegram/admins/:id/test     → test one admin's chat
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import api from "../data/axiosConfig";
import { getRole } from "../data/dataService";
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
  Users,
  Building2,
} from "lucide-react";

// Campaign sources that trigger notifications — mirrors telegramService.js
const CAMPAIGN_SOURCES = ["Meta (Facebook/Instagram)", "Google Ads", "Website/Landing Page"];

// ── Inline feedback banner ────────────────────────────────────────────────────
function Feedback({ msg }) {
  if (!msg?.text) return null;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-medium
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

// ── Company Group Tab ─────────────────────────────────────────────────────────
function CompanyGroupTab({ isSuperAdmin }) {
  const [loading,      setLoading]      = useState(true);
  const [chatId,       setChatId]       = useState("");
  const [hasToken,     setHasToken]     = useState(false);
  const [enabled,      setEnabled]      = useState(false);
  const [draftChat,    setDraftChat]    = useState("");
  const [draftToken,   setDraftToken]   = useState("");
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [showToken,    setShowToken]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [testing,      setTesting]      = useState(false);
  const [msg,          setMsg]          = useState({ type: "", text: "" });
  const inputRef = useRef(null);

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

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const flash = (type, text) => {
    setMsg({ type, text });
    if (type === "ok") setTimeout(() => setMsg({ type: "", text: "" }), 3500);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { telegramChatId: draftChat.trim(), telegramEnabled: draftEnabled };
      if (draftToken.trim()) payload.telegramBotToken = draftToken.trim();
      await api.put("/admin/company/telegram", payload);
      setChatId(draftChat.trim());
      setEnabled(draftEnabled);
      if (draftToken.trim()) setHasToken(true);
      setDraftToken("");
      flash("ok", "Saved!");
    } catch (e) {
      flash("err", e.response?.data?.message || "Save failed.");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await api.post("/admin/company/telegram/test");
      flash("ok", "Test sent! Check your Telegram group.");
    } catch (e) {
      flash("err", e.response?.data?.message || "Test failed — check token & chat ID.");
    } finally { setTesting(false); }
  };

  const isConfigured = !!chatId && hasToken;
  const hasChanges   = draftChat !== chatId || draftToken.trim() !== "" || draftEnabled !== enabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-[#8B92A9]" />
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Campaign sources info */}
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

      {/* Enable / disable toggle */}
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

      {/* Bot Token — super_admin only */}
      {isSuperAdmin ? (
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
              {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-[#8B92A9] mt-1">
            Create via <span className="font-mono font-semibold">@BotFather</span> on Telegram. Shared by all admins.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400">Bot token is managed by your Super Admin.</p>
        </div>
      )}

      {/* Group Chat ID */}
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

      <Feedback msg={msg} />

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="flex-1 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50
            text-white text-[12px] font-semibold transition flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
          {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          Test
        </button>
      </div>

      {!isConfigured && (
        <p className="flex items-center gap-1.5 text-[10px] text-[#8B92A9] justify-center pb-0.5">
          <Lock className="w-3 h-3" />
          Add bot token + chat ID, then save to activate
        </p>
      )}
    </div>
  );
}

// ── Admin Alerts Tab ──────────────────────────────────────────────────────────
function AdminAlertsTab() {
  const [admins,  setAdmins]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState({});  // { [adminId]: bool }
  const [testing, setTesting] = useState({});  // { [adminId]: bool }
  const [msgs,    setMsgs]    = useState({});  // { [adminId]: { type, text } }
  const [drafts,  setDrafts]  = useState({});  // { [adminId]: { chatId, enabled } }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await api.get("/admin/company/telegram/admins");
      const list = res.data || [];
      setAdmins(list);
      const d = {};
      list.forEach(a => {
        d[a._id] = {
          chatId:  a.telegramChatId  || "",
          enabled: a.telegramNotificationsEnabled !== false,
        };
      });
      setDrafts(d);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setDraft = (adminId, field, value) =>
    setDrafts(prev => ({ ...prev, [adminId]: { ...prev[adminId], [field]: value } }));

  const flash = (adminId, type, text) => {
    setMsgs(prev => ({ ...prev, [adminId]: { type, text } }));
    if (type === "ok") setTimeout(() =>
      setMsgs(prev => ({ ...prev, [adminId]: { type: "", text: "" } })), 3500);
  };

  const handleSave = async (adminId) => {
    setSaving(prev => ({ ...prev, [adminId]: true }));
    try {
      const d = drafts[adminId] || {};
      await api.put(`/admin/company/telegram/admins/${adminId}`, {
        telegramChatId:               d.chatId.trim(),
        telegramNotificationsEnabled: d.enabled,
      });
      setAdmins(prev => prev.map(a =>
        String(a._id) === String(adminId)
          ? { ...a, telegramChatId: d.chatId.trim(), telegramNotificationsEnabled: d.enabled }
          : a
      ));
      flash(adminId, "ok", "Saved!");
    } catch (e) {
      flash(adminId, "err", e.response?.data?.message || "Save failed.");
    } finally {
      setSaving(prev => ({ ...prev, [adminId]: false }));
    }
  };

  const handleTest = async (adminId) => {
    setTesting(prev => ({ ...prev, [adminId]: true }));
    try {
      await api.post(`/admin/company/telegram/admins/${adminId}/test`);
      flash(adminId, "ok", "Test sent! Check Telegram.");
    } catch (e) {
      flash(adminId, "err", e.response?.data?.message || "Test failed.");
    } finally {
      setTesting(prev => ({ ...prev, [adminId]: false }));
    }
  };

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
          Each admin can receive <strong>personal</strong> campaign lead notifications in their own Telegram chat.
          Uses the company bot token — only the chat ID differs per admin.
        </p>
      </div>

      {admins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-[#8B92A9]">
          <Users className="w-7 h-7 opacity-30" />
          <p className="text-[12px]">No admins found for this company.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-0.5">
          {admins.map(admin => {
            const draft     = drafts[admin._id] || { chatId: "", enabled: true };
            const saved     = admin.telegramChatId || "";
            const isSaving  = saving[admin._id]  || false;
            const isTesting = testing[admin._id] || false;
            const fb        = msgs[admin._id]    || { type: "", text: "" };
            const isDirty   = draft.chatId.trim() !== saved
              || draft.enabled !== (admin.telegramNotificationsEnabled !== false);
            const isReady   = !!saved;

            return (
              <div key={admin._id} className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-3.5 space-y-2.5">

                {/* Admin header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                      {(admin.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{admin.name}</p>
                      <p className="text-[10px] text-[#8B92A9] truncate font-mono">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      admin.role === "super_admin"
                        ? "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}>
                      {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                    </span>
                    <button
                      onClick={() => setDraft(admin._id, "enabled", !draft.enabled)}
                      title={draft.enabled ? "Disable notifications for this admin" : "Enable notifications for this admin"}
                      className="shrink-0"
                    >
                      {draft.enabled
                        ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                        : <ToggleLeft  className="w-5 h-5 text-[#C4C9D9] dark:text-[#3E4257]" />
                      }
                    </button>
                  </div>
                </div>

                {/* Personal Chat ID input */}
                <div>
                  <label className="block text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1">
                    Personal Chat ID
                    {isReady && <span className="ml-1.5 text-[9px] font-normal text-emerald-500">● connected</span>}
                  </label>
                  <input
                    type="text"
                    value={draft.chatId}
                    onChange={e => setDraft(admin._id, "chatId", e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(admin._id); }}
                    placeholder="e.g. 987654321"
                    className="w-full px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                      bg-white dark:bg-[#1A1D27] text-[11px] text-[#0F1117] dark:text-[#F0F2FA]
                      placeholder:text-[#8B92A9] focus:outline-none focus:border-indigo-400 font-mono transition"
                  />
                  <p className="text-[9px] text-[#8B92A9] mt-0.5">
                    Admin gets this via <span className="font-mono">@userinfobot</span> on Telegram
                  </p>
                </div>

                {fb.text && <Feedback msg={fb} />}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(admin._id)}
                    disabled={isSaving || !isDirty}
                    className="flex-1 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
                      text-white text-[11px] font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => handleTest(admin._id)}
                    disabled={isTesting || !isReady}
                    title={!isReady ? "Save a chat ID first" : "Send test to this admin"}
                    className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                      text-[10px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
                      hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400
                      disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
                  >
                    {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Test
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TelegramSettings() {
  const role         = getRole();
  const isSuperAdmin = role === "superadmin" || role === "super_admin";

  const [open,      setOpen]      = useState(false);
  const [activeTab, setActiveTab] = useState("company");

  const popoverRef = useRef(null);

  // Status dot — re-fetched each time the popover closes so it reflects saved changes
  const [dotData, setDotData] = useState({ enabled: false, configured: false });

  useEffect(() => {
    api.get("/admin/company/telegram")
      .then(res => {
        const d = res.data || {};
        setDotData({
          enabled:    d.telegramEnabled || false,
          configured: !!(d.hasToken && d.telegramChatId),
        });
      })
      .catch(() => {});
  }, [open]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false); };
    const onKey   = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown",   onKey);
    };
  }, [open]);

  const TABS = [
    { id: "company", label: "Company Group", icon: Building2 },
    ...(isSuperAdmin ? [{ id: "admins", label: "Admin Alerts", icon: Users }] : []),
  ];

  return (
    <div className="relative" ref={popoverRef}>

      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Telegram Notifications"
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-150 focus:outline-none
          ${open
            ? "bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400"
            : "border-[#E5E7EB] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] hover:text-sky-500 hover:border-sky-300 dark:hover:border-sky-700 dark:hover:text-sky-400"
          }`}
      >
        <Send className="w-3.5 h-3.5" />
        {dotData.configured && (
          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-[#1A1D27]
            ${dotData.enabled ? "bg-emerald-500" : "bg-amber-400"}`}
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

          {/* Tab bar — only rendered for super_admin (has 2 tabs) */}
          {isSuperAdmin && (
            <div className="flex gap-1 px-4 pt-3 pb-0">
              {TABS.map(tab => {
                const Icon   = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition flex-1 justify-center
                      ${active
                        ? "border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        : "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:border-[#CBD5E1] dark:hover:border-[#3E4257] hover:text-[#4B5168] dark:hover:text-[#9DA3BB]"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab content */}
          <div className="px-4 py-3">
            {activeTab === "company" && <CompanyGroupTab isSuperAdmin={isSuperAdmin} />}
            {activeTab === "admins"  && <AdminAlertsTab />}
          </div>
        </div>
      )}
    </div>
  );
}
