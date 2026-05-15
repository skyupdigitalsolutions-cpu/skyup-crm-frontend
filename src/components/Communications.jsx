// src/components/Communications.jsx
// Unified Communications Hub — WhatsApp Chat + Email History + Email Blast
// Sidebar label: "Communications"  |  Icon suggestion: ChatBubbleLeftRightIcon

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import api from "../data/axiosConfig";

const API_URL    = import.meta.env.VITE_API_URL;
const SOCKET_URL = API_URL.replace("/api", "");

// ─────────────────────────────────────────────────────────────────────────────
// ── Shared helpers ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const d    = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "WA";
}

function sessionBanner(conv) {
  if (!conv?.sessionExpiresAt) return null;
  const remaining = new Date(conv.sessionExpiresAt) - Date.now();
  if (remaining <= 0) return { expired: true, text: "24h session expired — send a template message" };
  const hours = Math.floor(remaining / 3600000);
  const mins  = Math.floor((remaining % 3600000) / 60000);
  if (hours < 2) return { expired: false, text: `Session closes in ${hours}h ${mins}m` };
  return null;
}

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

// ─────────────────────────────────────────────────────────────────────────────
// ── TAB NAV ───────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function TabNav({ active, onChange }) {
  const tabs = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
        </svg>
      ),
      activeColor: "text-[#25D366] border-[#25D366]",
      activeBg: "bg-[#f0fdf4] dark:bg-[#052e1c]",
    },
    {
      key: "email",
      label: "Email",
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      ),
      activeColor: "text-[#7C3AED] border-[#7C3AED]",
      activeBg: "bg-[#f5f3ff] dark:bg-[#1e1040]",
    },
  ];

  return (
    <div className="flex gap-1 p-1 bg-[#F1F5F9] dark:bg-[#13161E] rounded-2xl">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
            active === t.key
              ? `${t.activeBg} ${t.activeColor.split(" ")[0]} shadow-sm`
              : "text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-[#9DA3BB]"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── WHATSAPP PANEL ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW CONVERSATION MODAL ───────────────────────────────────────────────────
// Admin enters a client number + template name to initiate a fresh conversation
// ─────────────────────────────────────────────────────────────────────────────
function NewConversationModal({ onClose, onSuccess, authHeaders }) {
  const [phone,        setPhone]        = useState("");
  const [contactName,  setContactName]  = useState("");
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US"); // FIX: "en" rejected by MSG91; use "en_US"
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const handleStart = async () => {
    if (!phone.trim())        return setError("Phone number is required");
    if (!templateName.trim()) return setError("Template name is required — WhatsApp requires a template to start a new conversation");
    setLoading(true); setError("");
    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/start-conversation`,
        {
          phone:        phone.trim().replace(/\D/g, ""),
          contactName:  contactName.trim(),
          templateName: templateName.trim(),
          languageCode: languageCode.trim() || "en_US",
        },
        authHeaders
      );
      onSuccess(data.conversation, data.message);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to start conversation";
      setError(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#f0fdf4] dark:bg-[#052e1c] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">New WhatsApp Chat</h2>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Start a conversation with any client number</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Info banner */}
          <div className="flex gap-2.5 bg-[#FFFBEB] dark:bg-[#1c1600] border border-[#FDE68A] dark:border-[#78350f] rounded-xl px-4 py-3">
            <span className="text-[14px] shrink-0 mt-0.5">💡</span>
            <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D] leading-relaxed">
              WhatsApp requires a <strong>pre-approved template</strong> to initiate a new conversation.
              Once the client replies, you can send free-form messages for 24 hours.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Client WhatsApp Number <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="919876543210 (with country code, no +)"
              className={FIELD_CLS}
              autoFocus
            />
            <p className="text-[10px] text-[#8B92A9] mt-1">Include country code — e.g. 91 for India, 1 for USA</p>
          </div>

          {/* Contact name */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Client Name <span className="text-[#8B92A9] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Rahul Sharma"
              className={FIELD_CLS}
            />
          </div>

          {/* Template name */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Template Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. welcome_message, follow_up_v2"
              className={FIELD_CLS}
            />
            <p className="text-[10px] text-[#8B92A9] mt-1">
              Must match exactly the approved template name in your MSG91 / Meta dashboard
            </p>
          </div>

          {/* Language */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Template Language</label>
            <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className={FIELD_CLS}>
              <option value="en_US">English (en_US) — recommended</option>
              <option value="en_GB">English GB (en_GB)</option>
              <option value="en">English (en) — legacy</option>
              <option value="hi">Hindi (hi)</option>
              <option value="mr">Marathi (mr)</option>
              <option value="gu">Gujarati (gu)</option>
              <option value="ta">Tamil (ta)</option>
              <option value="te">Telugu (te)</option>
              <option value="kn">Kannada (kn)</option>
              <option value="ml">Malayalam (ml)</option>
              <option value="bn">Bengali (bn)</option>
              <option value="pa">Punjabi (pa)</option>
            </select>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626]">
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!phone.trim() || !templateName.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white text-[13px] font-semibold hover:bg-[#1da851] disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Starting…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>Send Template & Start Chat</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── RE-ENGAGE MODAL (inline) — sends a template to re-open expired session ───
// ─────────────────────────────────────────────────────────────────────────────
function ReEngageModal({ conversationId, authHeaders, onSent }) {
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  const handleSend = async () => {
    if (!templateName.trim()) return setError("Template name is required");
    setLoading(true); setError("");
    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/send-template`,
        { conversationId, templateName: templateName.trim(), languageCode },
        authHeaders
      );
      onSent(data.message);
      setTemplateName("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send template");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
          placeholder="Template name (e.g. hello, follow_up)"
          className={FIELD_CLS + " flex-1 text-[12px]"}
          autoFocus
        />
        <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className={FIELD_CLS + " w-[130px] text-[12px]"}>
          <option value="en_US">en_US</option>
          <option value="en_GB">en_GB</option>
          <option value="hi">hi</option>
          <option value="mr">mr</option>
          <option value="gu">gu</option>
          <option value="ta">ta</option>
          <option value="te">te</option>
          <option value="kn">kn</option>
        </select>
        <button
          onClick={handleSend}
          disabled={!templateName.trim() || loading}
          className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[12px] font-semibold disabled:opacity-40 transition shrink-0 flex items-center gap-1.5"
        >
          {loading
            ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          }
          Re-engage
        </button>
      </div>
      {error && <p className="text-[11px] text-[#DC2626]">⚠ {error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── BULK WHATSAPP MODAL ───────────────────────────────────────────────────────
// Admin sends a template message to ALL leads in one click
// ─────────────────────────────────────────────────────────────────────────────
function WhatsAppBlastModal({ onClose, authHeaders }) {
  // Mode: campaign | single | csv
  const [mode,        setMode]        = useState("campaign");

  // Campaign mode
  const [campaigns,   setCampaigns]   = useState([]);
  const [campaign,    setCampaign]    = useState("");
  const [leadCount,   setLeadCount]   = useState(null);
  const [previewing,  setPreviewing]  = useState(false);

  // Single mode
  const [singleName,  setSingleName]  = useState("");
  const [singlePhone, setSinglePhone] = useState("");

  // CSV mode
  const [csvText,   setCsvText]   = useState("name,phone\nRahul Sharma,919876543210\nPriya Patel,919812345678");
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvError,  setCsvError]  = useState("");

  // Template (shared)
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");

  // UI state
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  // Load campaign list on mount
  useEffect(() => {
    api.get("/email/history/campaigns")
      .then((r) => setCampaigns(r.data.data || []))
      .catch(() => {});
  }, []);

  // Campaign preview
  const handlePreview = async () => {
    if (!campaign) return;
    setPreviewing(true); setLeadCount(null);
    try {
      const res = await api.get(`/email-campaign/preview?campaign=${encodeURIComponent(campaign)}`);
      setLeadCount(res.data.leadCount);
    } catch (err) {
      setError(err.response?.data?.message || "Could not fetch preview");
    } finally { setPreviewing(false); }
  };

  // CSV parse
  const parseCSV = () => {
    setCsvError("");
    const lines = csvText.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return setCsvError("Need at least a header row and one data row");
    const header   = lines[0].toLowerCase().split(",").map((s) => s.trim());
    const nameIdx  = header.indexOf("name");
    const phoneIdx = header.findIndex((h) => h === "phone" || h === "mobile" || h === "number");
    if (phoneIdx === -1) return setCsvError("CSV must have a \'phone\' (or \'mobile\') column");
    const rows = lines.slice(1).map((line) => {
      const cols  = line.split(",").map((s) => s.trim());
      const phone = cols[phoneIdx]?.replace(/\D/g, "");
      return { name: nameIdx !== -1 ? cols[nameIdx] : "Friend", phone };
    }).filter((r) => r.phone && r.phone.length >= 7);
    if (rows.length === 0) return setCsvError("No valid phone rows found");
    setCsvParsed(rows);
  };

  // Send
  const handleSend = async () => {
    if (!templateName.trim()) return setError("Template name is required");
    setLoading(true); setError("");
    try {
      let res;
      if (mode === "campaign") {
        if (!campaign) { setLoading(false); return setError("Select a campaign"); }
        let count = leadCount;
        if (count === null) {
          setPreviewing(true);
          const r = await api.get(`/email-campaign/preview?campaign=${encodeURIComponent(campaign)}`);
          count = r.data.leadCount; setLeadCount(count); setPreviewing(false);
        }
        if (!window.confirm(`Send "${templateName}" to ${count} leads in "${campaign}"? This cannot be undone.`)) { setLoading(false); return; }
        res = await axios.post(`${API_URL}/whatsapp/bulk-send`, { campaign, templateName: templateName.trim(), languageCode }, authHeaders);
      } else if (mode === "single") {
        if (!singlePhone.trim()) { setLoading(false); return setError("Phone number is required"); }
        const phone = singlePhone.replace(/\D/g, "");
        if (!window.confirm(`Send "${templateName}" to ${singleName || "this contact"} (${phone})?`)) { setLoading(false); return; }
        await axios.post(`${API_URL}/whatsapp/start-conversation`, { phone, contactName: singleName.trim() || undefined, templateName: templateName.trim(), languageCode }, authHeaders);
        res = { data: { sent: 1, failed: 0, total: 1, results: [{ name: singleName, phone, status: "sent" }] } };
      } else {
        if (!csvParsed) { setLoading(false); return setError("Parse the CSV first"); }
        if (!window.confirm(`Send "${templateName}" to ${csvParsed.length} recipients from CSV? This cannot be undone.`)) { setLoading(false); return; }
        res = await axios.post(`${API_URL}/whatsapp/bulk-send-csv`, { recipients: csvParsed, templateName: templateName.trim(), languageCode }, authHeaders);
      }
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Failed to send");
    } finally { setLoading(false); }
  };

  const recipientLabel =
    mode === "campaign" && leadCount !== null ? `${leadCount} leads`
    : mode === "single" && singlePhone.trim() ? "1 recipient"
    : mode === "csv" && csvParsed ? `${csvParsed.length} recipients`
    : "recipients";

  const isValid =
    templateName.trim() &&
    (mode === "campaign" ? !!campaign : mode === "single" ? !!singlePhone.trim() : !!csvParsed);

  // Result screen
  if (result) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#f0fdf4] dark:bg-[#052e1c] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">WhatsApp Blast Complete!</h2>
        <p className="text-[12px] text-[#8B92A9] mb-5">Template messages dispatched successfully.</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[{ label: "Sent", value: result.sent ?? 1, color: "#25D366" }, { label: "Failed", value: result.failed ?? 0, color: "#DC2626" }, { label: "Total", value: result.total ?? 1, color: "#2563EB" }].map((s) => (
            <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 text-center border border-[#E4E7EF] dark:border-[#262A38]">
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-[#8B92A9] uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {result.results?.filter(r => r.status === "failed").length > 0 && (
          <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] rounded-xl px-4 py-3 text-left text-[11px] text-[#DC2626] mb-4 max-h-28 overflow-y-auto">
            {result.results.filter(r => r.status === "failed").slice(0, 5).map((r, i) => (
              <div key={i}>{r.name} ({r.phone}): {r.reason}</div>
            ))}
          </div>
        )}
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#25D366] text-white text-[13px] font-semibold hover:bg-[#1da851] transition">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[94vh]" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#f0fdf4] dark:bg-[#052e1c] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Send WhatsApp Blast</h2>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Personalized bulk messages via MSG91</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {[{ key: "campaign", label: "Campaign leads" }, { key: "single", label: "Single lead" }, { key: "csv", label: "CSV import" }].map((m) => (
              <button key={m.key} onClick={() => { setMode(m.key); setError(""); }}
                className={`py-2 rounded-xl border text-[12px] font-semibold transition ${mode === m.key ? "border-[#25D366] bg-[#f0fdf4] dark:bg-[#052e1c] text-[#25D366]" : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#25D366]/50"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">

          {/* Campaign mode */}
          {mode === "campaign" && (
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Target campaign</label>
              <div className="flex gap-2">
                <select value={campaign} onChange={(e) => { setCampaign(e.target.value); setLeadCount(null); }} className={FIELD_CLS + " flex-1"}>
                  <option value="">— Select a campaign —</option>
                  {[...new Set(campaigns.map((c) => c).filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={handlePreview} disabled={!campaign || previewing}
                  className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#25D366] hover:border-[#25D366] disabled:opacity-40 transition shrink-0">
                  {previewing ? "…" : "Preview"}
                </button>
              </div>
              {leadCount !== null && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                  <span className="text-[#25D366] font-semibold">{leadCount} leads</span>
                  <span className="text-[#8B92A9]">with mobile numbers will receive this</span>
                </div>
              )}
            </div>
          )}

          {/* Single mode */}
          {mode === "single" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Contact name <span className="text-[#8B92A9] font-normal">(optional)</span></label>
                <input type="text" value={singleName} onChange={(e) => setSingleName(e.target.value)} placeholder="Rahul Sharma" className={FIELD_CLS} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">WhatsApp number <span className="text-[#DC2626]">*</span></label>
                <input type="tel" value={singlePhone} onChange={(e) => setSinglePhone(e.target.value)} placeholder="919876543210 (with country code)" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Include country code, no + sign</p>
              </div>
            </div>
          )}

          {/* CSV mode */}
          {mode === "csv" && (
            <div>
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 mb-2 rounded-xl border-2 border-dashed border-[#25D366]/40 bg-[#f0fdf4] dark:bg-[#052e1c] text-[#25D366] text-[12px] font-semibold cursor-pointer hover:border-[#25D366] transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                Upload CSV file
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { setCsvText(ev.target.result); setCsvParsed(null); setCsvError(""); }; r.readAsText(f); e.target.value = ""; }} />
              </label>
              <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setCsvParsed(null); setCsvError(""); }} rows={4} className={FIELD_CLS + " font-mono text-[12px] resize-y"} placeholder={"name,phone\nRahul Sharma,919876543210"} />
              <p className="text-[10px] text-[#8B92A9] mt-1 mb-2">Required column: <code className="bg-[#f0fdf4] dark:bg-[#052e1c] text-[#25D366] px-1 rounded">phone</code> or <code className="bg-[#f0fdf4] dark:bg-[#052e1c] text-[#25D366] px-1 rounded">mobile</code>. Optional: <code className="bg-[#f0fdf4] dark:bg-[#052e1c] text-[#25D366] px-1 rounded">name</code>. Include country code.</p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={parseCSV} className="px-4 py-2 rounded-xl bg-[#f0fdf4] dark:bg-[#052e1c] text-[#25D366] text-[12px] font-semibold hover:bg-[#dcfce7] transition border border-[#25D366]/30">Parse CSV</button>
                {csvParsed && <span className="text-[12px] text-[#25D366] font-semibold">✓ {csvParsed.length} recipients found</span>}
              </div>
              {csvError && <p className="text-[11px] text-[#DC2626] mt-1">⚠ {csvError}</p>}
            </div>
          )}

          {/* Template section */}
          <div className="pt-1 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-3">WhatsApp Template</p>
            <div className="flex gap-2.5 bg-[#FFFBEB] dark:bg-[#1c1600] border border-[#FDE68A] dark:border-[#78350f] rounded-xl px-4 py-3 mb-4">
              <span className="text-[14px] shrink-0 mt-0.5">💡</span>
              <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D] leading-relaxed">
                WhatsApp requires a <strong>pre-approved template</strong> to send bulk messages. The template name must exactly match what is approved in your MSG91 / Meta dashboard.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Template name <span className="text-[#DC2626]">*</span></label>
                <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. welcome_message, follow_up_v2" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Must match exactly — case-sensitive</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Template language</label>
                <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className={FIELD_CLS}>
                  <option value="en_US">English (en_US) — recommended</option>
                  <option value="en_GB">English GB (en_GB)</option>
                  <option value="en">English (en) — legacy</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="mr">Marathi (mr)</option>
                  <option value="gu">Gujarati (gu)</option>
                  <option value="ta">Tamil (ta)</option>
                  <option value="te">Telugu (te)</option>
                  <option value="kn">Kannada (kn)</option>
                  <option value="ml">Malayalam (ml)</option>
                  <option value="bn">Bengali (bn)</option>
                  <option value="pa">Punjabi (pa)</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626]">⚠ {error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
            Cancel
          </button>
          <button onClick={handleSend} disabled={!isValid || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white text-[13px] font-semibold hover:bg-[#1da851] disabled:opacity-40 transition flex items-center justify-center gap-2">
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Sending…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>Send to {recipientLabel}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


function WhatsAppPanel({ currentUser }) {
  const socketRef  = useRef(null);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState("");
  const [loading,       setLoading]       = useState(false);
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [filter,        setFilter]        = useState("all");
  const [error,         setError]         = useState("");
  const [showNewChat,   setShowNewChat]   = useState(false);
  const [bulkModal,     setBulkModal]     = useState(false);
  const [sideTab,       setSideTab]       = useState("chats");
  const [leads,         setLeads]         = useState([]);
  const [leadsLoading,  setLeadsLoading]  = useState(false);
  const [leadsSearch,   setLeadsSearch]   = useState("");
  const [startModal,    setStartModal]    = useState(null);
  const [tmplName,      setTmplName]      = useState("");
  const [tmplLang,      setTmplLang]      = useState("en_US");
  const [starting,      setStarting]      = useState(false);
  const [startErr,      setStartErr]      = useState("");

  const isAdmin     = currentUser?.role === "admin";
  const token       = localStorage.getItem("token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };


  const handleNewConversation = (conv, firstMsg) => {
    // FIX: after admin starts a new conversation, re-fetch it so sessionExpiresAt is populated.
    // The returned conv object is pre-update (sessionExpiresAt still null), causing
    // the "24-hour session expired" banner to appear immediately on new chats.
    setConversations((prev) => {
      const exists = prev.find((c) => c._id === conv._id);
      if (exists) return prev;
      return [conv, ...prev];
    });
    // Pre-populate the template message so the chat window is not empty
    if (firstMsg) setMessages([firstMsg]);
    // Select and then re-load from server to get updated sessionExpiresAt
    setSelected(conv);
    setError("");
    axios.get(`${API_URL}/whatsapp/conversations/${conv._id}/messages`, authHeaders)
      .then(({ data }) => {
        setMessages(data.messages || (firstMsg ? [firstMsg] : []));
        // Update the conversation in the list with fresh sessionExpiresAt
        setConversations((prev) =>
          prev.map((c) => c._id === conv._id ? { ...c, ...data.conversation } : c)
        );
        setSelected((sel) => sel?._id === conv._id ? { ...sel, ...data.conversation } : sel);
      })
      .catch(() => { if (firstMsg) setMessages([firstMsg]); });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/whatsapp/conversations`, authHeaders);
      setConversations(data.conversations || []);
    } catch {}
  }, []);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/whatsapp/leads`, authHeaders);
      setLeads(data.leads || []);
    } catch {}
    finally { setLeadsLoading(false); }
  }, []);

  const loadMessages = useCallback(async (conv) => {
    setLoading(true);
    setMessages([]);
    try {
      const { data } = await axios.get(`${API_URL}/whatsapp/conversations/${conv._id}/messages`, authHeaders);
      setMessages(data.messages || []);
      setConversations((prev) => prev.map((c) => c._id === conv._id ? { ...c, unreadCount: 0 } : c));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;
    if (isAdmin) socket.emit("wa_admin_join");
    else if (currentUser?._id) socket.emit("wa_agent_join", { agentId: currentUser._id });

    socket.on("wa_message", (payload) => {
      const { conversationId, message: msg } = payload;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === conversationId);
        if (idx === -1) { loadConversations(); return prev; }
        const updated = [...prev];
        const conv    = { ...updated[idx] };
        conv.lastMessage   = msg.body;
        conv.lastMessageAt = msg.waTimestamp;
        if (msg.direction === "inbound") { conv.status = "waiting"; conv.unreadCount = (conv.unreadCount || 0) + 1; }
        else conv.status = "open";
        updated[idx] = conv;
        updated.unshift(updated.splice(idx, 1)[0]);
        return updated;
      });
      setSelected((sel) => {
        if (sel?._id === conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === msg._id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        return sel;
      });
    });

    socket.on("wa_new_conversation", ({ conversation }) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conversation._id);
        if (exists) return prev;
        return [conversation, ...prev];
      });
    });
    socket.on("wa_status_update", ({ waMessageId, status }) => {
      setMessages((prev) => prev.map((m) => m.waMessageId === waMessageId ? { ...m, status } : m));
    });
    socket.on("wa_assigned", () => loadConversations());
    loadConversations();
    loadLeads();
    return () => socket.disconnect();
  }, [currentUser]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectConversation = (conv) => {
    setSelected(conv); setError(""); loadMessages(conv);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    if (!text.trim() || !selected || sending) return;
    const msgText = text.trim();
    setText(""); setSending(true); setError("");
    const optimistic = { _id: `opt_${Date.now()}`, direction: "outbound", body: msgText, messageType: "text", waTimestamp: new Date(), status: "pending", sentBy: { name: currentUser?.name } };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const { data } = await axios.post(`${API_URL}/whatsapp/send`, { conversationId: selected._id, text: msgText }, authHeaders);
      setMessages((prev) => prev.map((m) => m._id === optimistic._id ? { ...optimistic, ...data.message } : m));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      const code = err.response?.data?.code;
      setError(code === "SESSION_EXPIRED" ? "24-hour session expired. Use a template message to re-engage." : err.response?.data?.error || "Failed to send message");
    } finally { setSending(false); }
  };

  const closeConversation = async () => {
    if (!selected) return;
    try {
      await axios.patch(`${API_URL}/whatsapp/conversations/${selected._id}/close`, {}, authHeaders);
      setConversations((prev) => prev.map((c) => c._id === selected._id ? { ...c, status: "closed" } : c));
      setSelected((prev) => ({ ...prev, status: "closed" }));
    } catch {}
  };

  // FIX: Delete zombie conversations (created when template send failed — "No messages yet")
  const deleteConversation = async (convId) => {
    if (!window.confirm("Delete this conversation and all its messages? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_URL}/whatsapp/conversations/${convId}`, authHeaders);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (selected?._id === convId) { setSelected(null); setMessages([]); }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete conversation");
    }
  };

  const filtered = conversations.filter((c) => {
    const matchSearch = !search || c.contactName?.toLowerCase().includes(search.toLowerCase()) || c.waPhone?.includes(search) || c.lead?.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.status === filter;
    return matchSearch && matchFilter;
  });

  const session = sessionBanner(selected);

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-[#E4E7EF] dark:border-[#262A38]">
      {/* Sidebar */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-[#E4E7EF] dark:border-[#262A38] bg-[#FAFBFE] dark:bg-[#13161E]">
        <div className="p-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="relative mb-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
            <input type="text" placeholder="Search by name or number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-2 w-full rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#25D366] transition" />
          </div>
          <div className="flex gap-1">
            {["all","open","waiting","closed"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`flex-1 text-[10px] py-1 rounded-lg font-semibold capitalize transition ${filter === f ? "bg-[#25D366] text-white" : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:text-[#4B5168]"}`}>{f}</button>
            ))}
          </div>
          {isAdmin && (
            <button
              onClick={() => setBulkModal(true)}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[12px] font-semibold transition"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              Bulk WhatsApp
            </button>
          )}
        </div>

        {/* Sub-tabs: Chats | Leads */}
        <div className="flex border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[{key:"chats",label:"Chats"},{key:"leads",label:`Leads (${leads.length})`}].map(t => (
            <button key={t.key} onClick={() => { setSideTab(t.key); if(t.key==="leads" && leads.length===0) loadLeads(); }}
              className={`flex-1 py-2 text-[11px] font-semibold transition border-b-2 ${sideTab===t.key ? "border-[#25D366] text-[#25D366]" : "border-transparent text-[#8B92A9] hover:text-[#4B5168] dark:hover:text-[#9DA3BB]"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CHATS list */}
        {sideTab === "chats" && <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <span className="text-3xl">💬</span>
              <p className="text-[#8B92A9] text-[12px]">No conversations yet</p>
              <button onClick={() => setSideTab("leads")} className="text-[11px] text-[#25D366] hover:underline font-semibold">Go to Leads →</button>
            </div>
          )}
          {filtered.map((conv) => {
            const isActive  = selected?._id === conv._id;
            const hasUnread = conv.unreadCount > 0;
            // A zombie conversation: no messages and no session — created by a failed template send
            const isZombie  = isAdmin && !conv.lastMessage && !conv.sessionExpiresAt;
            return (
              <div key={conv._id} onClick={() => selectConversation(conv)} className={`relative flex items-center gap-2.5 px-3 py-3 cursor-pointer border-b border-[#E4E7EF] dark:border-[#262A38] transition-colors group ${isActive ? "bg-[#f0fdf4] dark:bg-[#052e1c]" : "hover:bg-[#F8F9FC] dark:hover:bg-[#1A1D27]"}`}>
                <div className="w-9 h-9 rounded-full bg-[#dcfce7] flex items-center justify-center font-semibold text-[13px] text-[#166534] shrink-0">
                  {getInitials(conv.contactName || conv.lead?.name || conv.waPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className={`text-[12px] truncate max-w-[120px] ${hasUnread ? "font-semibold text-[#0F1117] dark:text-[#F0F2FA]" : "font-medium text-[#4B5168] dark:text-[#9DA3BB]"}`}>
                      {conv.contactName || conv.lead?.name || `+${conv.waPhone}`}
                    </span>
                    <span className="text-[10px] text-[#8B92A9] shrink-0">{timeAgo(conv.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-[11px] truncate max-w-[130px] ${isZombie ? "text-[#DC2626]" : "text-[#8B92A9]"}`}>
                      {isZombie ? "⚠ Template failed — tap to delete" : conv.lastMessage || "No messages yet"}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: conv.status === "waiting" ? "#f59e0b" : conv.status === "open" ? "#22c55e" : "#9ca3af" }} />
                      {hasUnread && <span className="bg-[#25D366] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{conv.unreadCount}</span>}
                    </div>
                  </div>
                  {isAdmin && conv.assignedAgent && <div className="text-[10px] text-[#8B92A9] mt-0.5">{conv.assignedAgent.name}</div>}
                </div>
                {/* Delete button — only visible on hover for zombie conversations */}
                {isZombie && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv._id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-[#FEF2F2] dark:bg-[#2D0A0A] flex items-center justify-center text-[#DC2626] hover:bg-[#fee2e2] transition"
                    title="Delete this failed conversation"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>}

        {/* LEADS list */}
        {sideTab === "leads" && <div className="flex-1 overflow-y-auto">
          <div className="p-2 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <input type="text" placeholder="Search name or phone..." value={leadsSearch} onChange={e => setLeadsSearch(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#25D366] transition" />
          </div>
          {leadsLoading && <div className="p-6 text-center text-[#8B92A9] text-[12px]">Loading leads...</div>}
          {!leadsLoading && leads.filter(l => !leadsSearch || l.name?.toLowerCase().includes(leadsSearch.toLowerCase()) || l.mobile?.includes(leadsSearch)).map(lead => {
            const hasConv = !!lead.existingConversationId;
            return (
              <div key={lead._id} className="flex items-center gap-2.5 px-3 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#1A1D27] transition">
                <div className="w-9 h-9 rounded-full bg-[#dcfce7] flex items-center justify-center font-semibold text-[13px] text-[#166534] shrink-0">
                  {getInitials(lead.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{lead.name}</div>
                  <div className="text-[11px] text-[#8B92A9]">{lead.mobile}</div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{background: lead.status==="Converted"?"#dcfce7":lead.status==="In Progress"?"#fef9c3":lead.status==="Not Interested"?"#fee2e2":"#dbeafe", color: lead.status==="Converted"?"#166534":lead.status==="In Progress"?"#854d0e":lead.status==="Not Interested"?"#991b1b":"#1e40af"}}>{lead.status}</span>
                </div>
                {hasConv ? (
                  <button onClick={() => { const c = conversations.find(c=>c._id===lead.existingConversationId); if(c){selectConversation(c);setSideTab("chats");}else{loadConversations().then(()=>setSideTab("chats"));} }}
                    title="Open existing chat" className="w-8 h-8 rounded-full bg-[#dcfce7] border border-[#bbf7d0] flex items-center justify-center text-[#166534] hover:bg-[#bbf7d0] transition shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                  </button>
                ) : (
                  <button onClick={() => { setStartModal(lead); setTmplName(""); setTmplLang("en_US"); setStartErr(""); }}
                    title="Start WhatsApp chat" className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white hover:bg-[#1da851] transition shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  </button>
                )}
              </div>
            );
          })}
          {!leadsLoading && leads.length === 0 && <div className="p-6 text-center text-[#8B92A9] text-[12px]">No leads found</div>}
        </div>}
      </div>

      {/* Start conversation modal */}
      {startModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={()=>setStartModal(null)}>
          <div className="bg-white dark:bg-[#1A1D27] rounded-2xl p-6 w-[360px] shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-[15px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Start WhatsApp Chat</h3>
            <p className="text-[12px] text-[#8B92A9] mb-4">{startModal.name} · {startModal.mobile}</p>
            <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Template Name <span className="text-[#DC2626]">*</span></label>
            <input value={tmplName} onChange={e=>setTmplName(e.target.value)} placeholder="e.g. hello_world" className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#25D366] mb-3 transition" />
            <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Language Code</label>
            <input value={tmplLang} onChange={e=>setTmplLang(e.target.value)} placeholder="en_US" className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#25D366] mb-3 transition" />
            {startErr && <p className="text-[11px] text-[#DC2626] mb-3">{startErr}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={()=>setStartModal(null)} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
              <button disabled={starting||!tmplName.trim()} onClick={async()=>{
                setStarting(true); setStartErr("");
                try {
                  const phone = (startModal.mobile||"").replace(/\D/g,"");
                  const {data} = await axios.post(`${API_URL}/whatsapp/start-conversation`,{phone,contactName:startModal.name,templateName:tmplName.trim(),languageCode:tmplLang||"en_US"},authHeaders);
                  const conv = data.conversation;
                  setConversations(prev=>[conv,...prev.filter(c=>c._id!==conv._id)]);
                  setLeads(prev=>prev.map(l=>l._id===startModal._id?{...l,existingConversationId:conv._id}:l));
                  setStartModal(null); selectConversation(conv); setSideTab("chats");
                }catch(e){setStartErr(e.response?.data?.error||"Failed to start conversation");}
                finally{setStarting(false);}
              }} className="flex-1 py-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] disabled:opacity-50 text-white text-[12px] font-semibold transition">
                {starting?"Sending…":"Send Template"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat window */}
      {!selected ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[#8B92A9] bg-white dark:bg-[#1A1D27]">
          <div className="w-14 h-14 rounded-full bg-[#f0fdf4] dark:bg-[#052e1c] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Select a conversation</p>
          <p className="text-[12px] mt-1">Choose a chat from the list to view messages</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1A1D27]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#dcfce7] flex items-center justify-center font-semibold text-[13px] text-[#166534] shrink-0">
              {getInitials(selected.contactName || selected.lead?.name || selected.waPhone)}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px] text-[#0F1117] dark:text-[#F0F2FA]">
                {selected.contactName || selected.lead?.name || `+${selected.waPhone}`}
              </div>
              <div className="text-[11px] text-[#8B92A9]">
                +{selected.waPhone}
                {selected.lead && ` · ${selected.lead.status}`}
                {isAdmin && selected.assignedAgent && ` · Agent: ${selected.assignedAgent.name}`}
              </div>
            </div>
            {selected.status !== "closed" && (
              <button onClick={closeConversation} className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition">
                Mark resolved
              </button>
            )}
          </div>

          {session && (
            <div className={`px-4 py-2 text-[11px] border-b border-[#E4E7EF] dark:border-[#262A38] ${session.expired ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#FFFBEB] text-[#D97706]"}`}>
              ⚠️ {session.text}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2" style={{ background: "linear-gradient(to bottom, #f0fdf4 0%, #fafffe 100%)" }}>
            {loading && <div className="text-center text-[#8B92A9] text-[13px] py-8">Loading messages…</div>}
            {messages.map((msg) => {
              const isOut = msg.direction === "outbound";
              return (
                <div key={msg._id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[68%] px-3 py-2 rounded-2xl shadow-sm border ${isOut ? "bg-[#dcfce7] border-[#bbf7d0] rounded-br-sm" : "bg-white border-[#e5e7eb] rounded-bl-sm"}`}>
                    {isAdmin && isOut && msg.sentBy && (
                      <div className="text-[9px] text-[#166534] font-semibold mb-0.5">{msg.sentBy.name}</div>
                    )}
                    <div className="text-[13px] text-[#111827] leading-[1.5] whitespace-pre-wrap break-words">
                      {msg.messageType === "image" && "🖼️ "}
                      {msg.messageType === "document" && "📄 "}
                      {msg.messageType === "audio" && "🎵 "}
                      {msg.messageType === "video" && "🎥 "}
                      {msg.messageType === "location" && "📍 "}
                      {msg.messageType === "template" && "📋 "}
                      {msg.body}
                    </div>
                    <div className="flex justify-end items-center gap-1 mt-1">
                      <span className="text-[10px] text-[#6b7280]">{formatTime(msg.waTimestamp)}</span>
                      {isOut && (
                        <span className={`text-[10px] ${msg.status === "read" ? "text-[#2563eb]" : "text-[#9ca3af]"}`}>
                          {msg.status === "read" ? "✓✓" : msg.status === "delivered" ? "✓✓" : msg.status === "sent" ? "✓" : msg.status === "failed" ? "✗" : "⏳"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="px-4 py-2 bg-[#FEF2F2] text-[#DC2626] text-[11px] border-t border-[#FECACA] flex items-center justify-between">
              {error}
              <button onClick={() => setError("")} className="ml-2 text-inherit">✕</button>
            </div>
          )}

          {/* Input — show Re-engage button when session expired, normal input otherwise */}
          {session?.expired && selected.status !== "closed" ? (
            <div className="px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]">
              <p className="text-[11px] text-[#8B92A9] mb-2 text-center">24-hour session expired. Send a pre-approved template to re-open the conversation.</p>
              <ReEngageModal conversationId={selected._id} authHeaders={authHeaders} onSent={(msg) => {
                setMessages((prev) => [...prev, msg]);
                const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
                setSelected((s) => ({ ...s, sessionExpiresAt: newExpiry }));
                setConversations((prev) => prev.map((c) => c._id === selected._id ? { ...c, sessionExpiresAt: newExpiry, lastMessage: msg.body, lastMessageAt: new Date() } : c));
                setError("");
              }} />
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-2 items-end bg-white dark:bg-[#1A1D27]">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={selected.status === "closed" ? "Conversation is closed" : "Type a message… (Enter to send)"}
                disabled={selected.status === "closed" || sending}
                rows={1}
                className="flex-1 resize-none text-[13px] px-3 py-2.5 rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#25D366] transition leading-[1.5] max-h-[120px] overflow-y-auto"
              />
              <button onClick={sendMessage} disabled={!text.trim() || sending || selected.status === "closed"} className={`w-9 h-9 rounded-full flex items-center justify-center transition shrink-0 ${text.trim() && !sending ? "bg-[#25D366] hover:bg-[#1da851]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill={text.trim() && !sending ? "white" : "#9ca3af"}>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      {showNewChat && (
        <NewConversationModal
          onClose={() => setShowNewChat(false)}
          onSuccess={handleNewConversation}
          authHeaders={authHeaders}
        />
      )}
      {bulkModal && (
        <WhatsAppBlastModal
          onClose={() => setBulkModal(false)}
          authHeaders={authHeaders}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── EMAIL HISTORY + BLAST PANEL ───────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const isSent = status === "sent";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${isSent ? "bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]" : "bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626] dark:text-[#F87171]"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isSent ? "bg-[#059669]" : "bg-[#DC2626]"}`} />
      {isSent ? "Sent" : "Failed"}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[1,2,3,4,5].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-[#E4E7EF] dark:bg-[#262A38] rounded-full" style={{ width: `${60 + i * 8}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Log Detail Modal ──────────────────────────────────────────────────────────
function LogDetailModal({ logId, onClose }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/email/history/${logId}`)
      .then((r) => setLog(r.data.data))
      .catch(() => setLog(null))
      .finally(() => setLoading(false));
  }, [logId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] dark:bg-[#1E1040] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </div>
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Email Details</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8B92A9] gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              Loading…
            </div>
          ) : !log ? (
            <p className="text-center text-[#8B92A9] py-8">Could not load log details.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "To", value: log.to },
                  { label: "Campaign", value: log.campaignId || "—" },
                  { label: "Status", value: <StatusBadge status={log.status} /> },
                  { label: "Sent At", value: fmtDate(log.sentAt) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1">{label}</p>
                    <div className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{value}</div>
                  </div>
                ))}
              </div>
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3">
                <p className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-1">Subject</p>
                <p className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{log.subject}</p>
              </div>
              {log.errorMessage && (
                <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3">
                  <p className="text-[10px] font-semibold text-[#DC2626] uppercase tracking-wide mb-1">Error</p>
                  <p className="text-[12px] text-[#DC2626]">{log.errorMessage}</p>
                </div>
              )}
              {log.body && (
                <div>
                  <p className="text-[10px] font-semibold text-[#8B92A9] uppercase tracking-wide mb-2">Email Body</p>
                  <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-4 bg-white dark:bg-[#0D0F14] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] max-h-64 overflow-y-auto" dangerouslySetInnerHTML={{ __html: log.body }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Email Blast Modal ─────────────────────────────────────────────────────────
function EmailBlastModal({ onClose }) {
  const [mode, setMode] = useState("campaign");
  const [campaigns, setCampaigns] = useState([]);
  const [form, setForm] = useState({ campaign: "" });
  const [leadCount, setLeadCount] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [singleLead, setSingleLead] = useState({ name: "", email: "" });
  const [csvText, setCsvText] = useState("name,email\nRahul Sharma,rahul@gmail.com\nPriya Patel,priya@gmail.com");
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvError, setCsvError] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("<p>Hi {{name}},</p>\n<p>We are reaching out about our <strong>{{campaign}}</strong> campaign.</p>\n<p>Please feel free to contact us at any time.</p>\n<p>Regards,<br/>The Team</p>");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/email/history/campaigns").then((r) => setCampaigns(r.data.data || [])).catch(() => {});
  }, []);

  const MERGE_TAGS = ["{{name}}", "{{campaign}}", "{{mobile}}", "{{email}}"];

  const parseCSV = () => {
    setCsvError("");
    const lines = csvText.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return setCsvError("Need at least a header row and one data row");
    const header = lines[0].toLowerCase().split(",").map((s) => s.trim());
    const nameIdx = header.indexOf("name");
    const emailIdx = header.indexOf("email");
    if (emailIdx === -1) return setCsvError("CSV must have an 'email' column");
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((s) => s.trim());
      return { name: nameIdx !== -1 ? cols[nameIdx] : "Friend", email: cols[emailIdx] };
    }).filter((r) => r.email && r.email.includes("@"));
    if (rows.length === 0) return setCsvError("No valid email rows found");
    setCsvParsed(rows);
  };

  const handlePreview = async () => {
    if (!form.campaign) return;
    setPreviewing(true); setLeadCount(null);
    try {
      const res = await api.get(`/email-campaign/preview?campaign=${encodeURIComponent(form.campaign)}`);
      setLeadCount(res.data.leadCount);
    } catch (err) { setError(err.response?.data?.message || "Could not fetch preview"); }
    finally { setPreviewing(false); }
  };

  const handleSend = async () => {
    if (!subject || !bodyTemplate) return setError("Subject and body are required");
    setLoading(true); setError("");
    try {
      let res;
      if (mode === "campaign") {
        if (!form.campaign) return setError("Select a campaign");
        let count = leadCount;
        if (count === null) {
          setPreviewing(true);
          const r = await api.get(`/email-campaign/preview?campaign=${encodeURIComponent(form.campaign)}`);
          count = r.data.leadCount; setLeadCount(count); setPreviewing(false);
        }
        if (!window.confirm(`Send emails to ${count} leads in "${form.campaign}"?`)) { setLoading(false); return; }
        res = await api.post("/email-campaign/send", { campaign: form.campaign, subject, bodyTemplate, fromName: fromName || undefined });
      } else if (mode === "single") {
        if (!singleLead.email || !singleLead.name) return setError("Name and email are required");
        if (!window.confirm(`Send email to ${singleLead.name} (${singleLead.email})?`)) { setLoading(false); return; }
        res = await api.post("/email-campaign/send-single", { name: singleLead.name, email: singleLead.email, subject, bodyTemplate, fromName: fromName || undefined });
      } else {
        if (!csvParsed) return setError("Parse the CSV first");
        if (!window.confirm(`Send emails to ${csvParsed.length} recipients from CSV?`)) { setLoading(false); return; }
        res = await api.post("/email-campaign/send-csv", { recipients: csvParsed, subject, bodyTemplate, fromName: fromName || undefined });
      }
      setResult(res.data);
    } catch (err) { setError(err.response?.data?.message || err.message || "Failed to send"); }
    finally { setLoading(false); }
  };

  const insertTag = (tag) => setBodyTemplate((p) => p + tag);

  if (result) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Campaign Sent!</h2>
        <div className="grid grid-cols-3 gap-3 my-5">
          {[{ label: "Sent", value: result.sent ?? 1, color: "#059669" }, { label: "Failed", value: result.failed ?? 0, color: "#DC2626" }, { label: "Total", value: result.total ?? 1, color: "#2563EB" }].map((s) => (
            <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 text-center border border-[#E4E7EF] dark:border-[#262A38]">
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-[#8B92A9] uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {result.errors?.length > 0 && (
          <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] rounded-xl px-4 py-3 text-left text-[11px] text-[#DC2626] mb-4 max-h-28 overflow-y-auto">
            {result.errors.slice(0, 5).map((e, i) => <div key={i}>{e.email}: {e.error}</div>)}
          </div>
        )}
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 transition">Done</button>
      </div>
    </div>
  );

  const isValid = subject.trim() && bodyTemplate.trim() && (mode === "campaign" ? !!form.campaign : mode === "single" ? !!singleLead.email && !!singleLead.name : !!csvParsed);
  const recipientLabel = mode === "campaign" && leadCount !== null ? `${leadCount} leads` : mode === "single" && singleLead.email ? "1 recipient" : mode === "csv" && csvParsed ? `${csvParsed.length} recipients` : "recipients";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[94vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] dark:bg-[#1E1040] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#7C3AED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Send Email Blast</h2>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Personalized bulk emails via Brevo</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-6 pt-4 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "campaign", label: "Campaign leads" },
              { key: "single", label: "Single lead" },
              { key: "csv", label: "CSV import" },
            ].map((m) => (
              <button key={m.key} onClick={() => { setMode(m.key); setError(""); }} className={`py-2 rounded-xl border text-[12px] font-semibold transition ${mode === m.key ? "border-[#7C3AED] bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED]" : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#7C3AED]/50"}`}>{m.label}</button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Campaign mode */}
          {mode === "campaign" && (
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Target campaign</label>
              <div className="flex gap-2">
                <select value={form.campaign} onChange={(e) => { setForm((p) => ({ ...p, campaign: e.target.value })); setLeadCount(null); }} className={FIELD_CLS + " flex-1"}>
                  <option value="">— Select a campaign —</option>
                  {[...new Set(campaigns.map((c) => c).filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={handlePreview} disabled={!form.campaign || previewing} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#7C3AED] hover:border-[#7C3AED] disabled:opacity-40 transition shrink-0">
                  {previewing ? "…" : "Preview"}
                </button>
              </div>
              {leadCount !== null && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                  <span className="text-[#7C3AED] font-semibold">{leadCount} leads</span>
                  <span className="text-[#8B92A9]">with email addresses will receive this</span>
                </div>
              )}
            </div>
          )}

          {/* Single mode */}
          {mode === "single" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Full name *</label>
                <input type="text" value={singleLead.name} onChange={(e) => setSingleLead((p) => ({ ...p, name: e.target.value }))} placeholder="Rahul Sharma" className={FIELD_CLS} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Email address *</label>
                <input type="email" value={singleLead.email} onChange={(e) => setSingleLead((p) => ({ ...p, email: e.target.value }))} placeholder="rahul@gmail.com" className={FIELD_CLS} />
              </div>
            </div>
          )}

          {/* CSV mode */}
          {mode === "csv" && (
            <div>
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 mb-2 rounded-xl border-2 border-dashed border-[#7C3AED]/40 bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[12px] font-semibold cursor-pointer hover:border-[#7C3AED] transition">
                Upload CSV file
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { setCsvText(ev.target.result); setCsvParsed(null); setCsvError(""); }; r.readAsText(f); e.target.value = ""; }} />
              </label>
              <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setCsvParsed(null); setCsvError(""); }} rows={4} className={FIELD_CLS + " font-mono text-[12px] resize-y"} placeholder="name,email\nRahul,rahul@gmail.com" />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={parseCSV} className="px-4 py-2 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] text-[12px] font-semibold hover:bg-[#dce7ff] transition">Parse CSV</button>
                {csvParsed && <span className="text-[12px] text-[#059669] font-semibold">✓ {csvParsed.length} recipients found</span>}
              </div>
              {csvError && <p className="text-[11px] text-[#DC2626] mt-1">⚠ {csvError}</p>}
            </div>
          )}

          {/* Email details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Subject *</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Special offer for {{name}}!" className={FIELD_CLS} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">From name (optional)</label>
              <input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="SkyUp CRM Team" className={FIELD_CLS} />
            </div>
          </div>

          {/* Merge tags */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Merge tags — click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_TAGS.map((tag) => (
                <button key={tag} onClick={() => insertTag(tag)} className="px-2.5 py-1 rounded-lg bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[11px] font-mono font-semibold hover:bg-[#ede9fe] transition">{tag}</button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Email body (HTML) *</label>
            <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={8} className={FIELD_CLS + " font-mono text-[12px] resize-y"} />
          </div>

          {bodyTemplate && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Preview (sample data)</p>
              <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-4 bg-white dark:bg-[#0D0F14] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] max-h-44 overflow-y-auto" dangerouslySetInnerHTML={{ __html: bodyTemplate.replace(/{{name}}/g, "<strong>Rahul Sharma</strong>").replace(/{{campaign}}/g, form.campaign || "Summer Sale").replace(/{{mobile}}/g, "9876543210").replace(/{{email}}/g, "rahul@example.com") }} />
            </div>
          )}

          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626]">⚠ {error}</div>}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSend} disabled={!isValid || loading} className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
            {loading ? (<><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Sending…</>) : (<>Send to {recipientLabel}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Email Panel (history + blast button) ──────────────────────────────────────
function EmailPanel() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [campaigns, setCampaigns] = useState([]);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showBlast, setShowBlast] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.get("/email/history/campaigns").then((r) => setCampaigns(r.data.data || [])).catch(() => {});
  }, []);

  const fetchLogs = useCallback(async (page = 1, searchVal = search, campaign = campaignFilter, sort = sortOrder, from = dateFrom, to = dateTo) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit, search: searchVal, campaignId: campaign, sortOrder: sort });
      if (from) params.set("dateFrom", from);
      if (to) params.set("dateTo", to);
      const res = await api.get(`/email/history?${params}`);
      setLogs(res.data.data || []);
      setPagination((p) => ({ ...p, ...res.data.pagination, page }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load email history");
    } finally { setLoading(false); }
  }, [search, campaignFilter, sortOrder, dateFrom, dateTo, pagination.limit]);

  useEffect(() => { fetchLogs(1); }, []);

  const handleSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchLogs(1, val, campaignFilter, sortOrder), 400);
  };

  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({ page: 1, limit: 5000, search, campaignId: campaignFilter, sortOrder });
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await api.get(`/email/history?${params}`);
      const data = res.data.data || [];
      if (data.length === 0) { alert("No records to export"); return; }
      const headers = ["Recipient","Subject","Campaign","Status","Sent At","Error"];
      const rows = data.map((l) => [`"${l.to}"`, `"${l.subject.replace(/"/g,'""')}"`, `"${l.campaignId||""}"`, l.status, fmtDate(l.sentAt), `"${l.errorMessage||""}"`]);
      const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = `email-history-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Export failed"); }
    finally { setExportLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this log entry?")) return;
    setDeletingId(id);
    try { await api.delete(`/email/history/${id}`); fetchLogs(pagination.page); }
    catch { alert("Failed to delete log"); }
    finally { setDeletingId(null); }
  };

  const sentCount   = logs.filter((l) => l.status === "sent").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">
            {loading ? "Loading…" : `${pagination.total.toLocaleString()} total emails logged`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchLogs(pagination.page)} className="w-9 h-9 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] transition" title="Refresh">
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <button onClick={handleExportCSV} disabled={exportLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#059669] text-white text-[13px] font-semibold hover:bg-green-700 disabled:opacity-50 transition">
            {exportLoading ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
            Export CSV
          </button>
          <button onClick={() => setShowBlast(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            Send Email
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        {[
          { label: "This page", value: logs.length, color: "#2563EB" },
          { label: "Sent", value: sentCount, color: "#059669" },
          { label: "Failed", value: failedCount, color: "#DC2626" },
          { label: "All time", value: pagination.total, color: "#7C3AED" },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-3 py-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{s.value.toLocaleString()}</span>
            <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
          <input type="text" value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Search by recipient…" className="pl-8 pr-4 py-2 w-full rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition" />
          {search && <button onClick={() => handleSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9]"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>}
        </div>
        <select value={campaignFilter} onChange={(e) => { setCampaignFilter(e.target.value); fetchLogs(1, search, e.target.value, sortOrder); }} className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition">
          <option value="">All Source</option>
          {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); fetchLogs(1, search, campaignFilter, sortOrder, e.target.value, dateTo); }} className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition w-[140px]" title="From date" />
        <span className="text-[12px] text-[#8B92A9]">to</span>
        <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); fetchLogs(1, search, campaignFilter, sortOrder, dateFrom, e.target.value); }} className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition w-[140px]" title="To date" />
        {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); fetchLogs(1, search, campaignFilter, sortOrder, "", ""); }} className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] text-[#8B92A9] hover:text-[#DC2626] hover:border-[#DC2626] transition">✕ Clear</button>}
        <select value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); fetchLogs(1, search, campaignFilter, e.target.value, dateFrom, dateTo); }} className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
      </div>

      {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] mb-3 shrink-0">⚠ {error}</div>}

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
              {["Recipient","Subject","Source","Status","Sent At",""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-[#8B92A9] uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EF] dark:divide-[#262A38]">
            {loading ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-16 text-center">
                <div className="text-[36px] mb-3">📭</div>
                <p className="text-[14px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">No email logs found</p>
                <p className="text-[12px] text-[#8B92A9] mt-1">{search || campaignFilter || dateFrom || dateTo ? "Try clearing your filters." : "Send emails to start tracking history."}</p>
              </td></tr>
            ) : logs.map((log) => (
              <tr key={log._id} className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition-colors cursor-pointer" onClick={() => setSelectedLogId(log._id)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#F5F3FF] dark:bg-[#1E1040] flex items-center justify-center text-[10px] font-bold text-[#7C3AED] shrink-0">{log.to?.charAt(0)?.toUpperCase() || "?"}</div>
                    <span className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] max-w-[160px] truncate">{log.to}</span>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] max-w-[200px] truncate block">{log.subject}</span></td>
                <td className="px-4 py-3">
                  {log.campaignId ? <span className="inline-block px-2.5 py-1 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[11px] font-semibold max-w-[140px] truncate">{log.campaignId}</span> : <span className="text-[12px] text-[#8B92A9]">—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                <td className="px-4 py-3"><span className="text-[12px] text-[#8B92A9] whitespace-nowrap">{fmtDate(log.sentAt)}</span></td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => handleDelete(log._id)} disabled={deletingId === log._id} className="p-1.5 rounded-lg text-[#8B92A9] hover:text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A] transition disabled:opacity-40" title="Delete log">
                    {deletingId === log._id ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <span className="text-[12px] text-[#8B92A9]">Page {pagination.page} of {pagination.totalPages} · {pagination.total} total</span>
            <div className="flex items-center gap-1.5">
              <button disabled={pagination.page <= 1} onClick={() => fetchLogs(pagination.page - 1)} className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] disabled:opacity-40 hover:border-[#2563EB] hover:text-[#2563EB] transition">← Prev</button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
                const p = start + i;
                if (p > pagination.totalPages) return null;
                return <button key={p} onClick={() => fetchLogs(p)} className={`w-8 h-8 rounded-lg text-[12px] font-semibold transition ${p === pagination.page ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] hover:border-[#2563EB] hover:text-[#2563EB]"}`}>{p}</button>;
              })}
              <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchLogs(pagination.page + 1)} className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] disabled:opacity-40 hover:border-[#2563EB] hover:text-[#2563EB] transition">Next →</button>
            </div>
          </div>
        )}
      </div>

      {selectedLogId && <LogDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(null)} />}
      {showBlast && <EmailBlastModal onClose={() => setShowBlast(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN COMMUNICATIONS PAGE ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function Communications({ currentUser }) {
  const [tab, setTab] = useState("whatsapp");

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-6 flex flex-col">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 shrink-0">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Communications</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">WhatsApp chats & email history in one place</p>
        </div>
        <TabNav active={tab} onChange={setTab} />
      </div>

      {/* Panel area — fills remaining height */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {tab === "whatsapp" && (
          <div className="h-full" style={{ height: "calc(100vh - 160px)" }}>
            <WhatsAppPanel currentUser={currentUser} />
          </div>
        )}
        {tab === "email" && (
          <div className="h-full flex flex-col" style={{ height: "calc(100vh - 160px)" }}>
            <EmailPanel />
          </div>
        )}
      </div>
    </div>
  );
}