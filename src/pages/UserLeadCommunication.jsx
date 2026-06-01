// src/pages/UserLeadCommunication.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Communication page for the USER (employee) role.
// Two tabs:
//   1. Chat  — one-on-one WhatsApp chat with assigned leads
//   2. Blast — send a WhatsApp template to ALL assigned leads at once
//
// FIX: Ported the same robust socket logic from the admin Communications panel
// so inbound messages from leads appear in real-time in the employee chat UI.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import api from "../data/axiosConfig";

const API_URL = import.meta.env.VITE_API_URL || "https://skyup-crm-backend.onrender.com/api";
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, "")
    : "https://skyup-crm-backend.onrender.com");

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function sessionBanner(sessionExpiresAt) {
  if (!sessionExpiresAt) return null;
  const remaining = new Date(sessionExpiresAt) - Date.now();
  if (remaining <= 0) return { expired: true, text: "24h session expired — send a template message to re-engage" };
  const hours = Math.floor(remaining / 3600000);
  const mins  = Math.floor((remaining % 3600000) / 60000);
  if (hours < 2) return { expired: false, text: `Session closes in ${hours}h ${mins}m` };
  return null;
}

// Strip non-digits and return the last 10 digits for phone comparison.
// This handles the mismatch between 10-digit leads (e.g. "9538281101")
// and 12-digit waPhone values from the webhook (e.g. "919538281101").
function normalizePhone(p) {
  const digits = String(p || "").replace(/\D/g, "");
  return digits.slice(-10); // always compare last 10 digits
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }) {
  const initials = (name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626"];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sz = size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-[12px]";
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`}
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg, isOwn }) {
  const status = msg.status;
  return (
    <div className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"} px-3`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-[13px] shadow-sm ${
          isOwn
            ? "bg-[#DCF8C6] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] rounded-br-none"
            : "bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] rounded-bl-none border border-[#E4E7EF] dark:border-transparent"
        }`}
      >
        {msg.messageType === "image"    && <span>🖼️ </span>}
        {msg.messageType === "document" && <span>📄 </span>}
        {msg.messageType === "audio"    && <span>🎵 </span>}
        {msg.messageType === "video"    && <span>🎥 </span>}
        {msg.messageType === "template" && <span>📋 </span>}
        <p className="break-words leading-relaxed inline">{msg.body || msg.text || msg.message}</p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <p className="text-[10px] opacity-50">
            {fmtTime(msg.waTimestamp || msg.createdAt || msg.timestamp)}
          </p>
          {isOwn && (
            <span className={`text-[10px] ${status === "read" ? "text-[#2563eb]" : "text-[#9ca3af]"}`}>
              {status === "read" ? "✓✓" : status === "delivered" ? "✓✓" : status === "sent" ? "✓" : status === "failed" ? "✗" : "⏳"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyPane() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F0F4FF] dark:bg-[#0B141A]">
      <div className="w-20 h-20 rounded-full bg-[#2563EB]/10 flex items-center justify-center">
        <svg className="w-10 h-10 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-[15px] font-bold text-[#4B5168] dark:text-[#8B92A9]">Select a Lead to Chat</h3>
      <p className="text-[12px] text-[#8B92A9] text-center max-w-xs">
        You can only message your assigned leads. Select one from the left panel to start a WhatsApp conversation.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── RE-ENGAGE inline widget ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function ReEngageWidget({ conversationId, authHeaders, onSent }) {
  const [templateName, setTemplateName] = useState("crm_followup_leads");
  const [languageCode, setLanguageCode] = useState("en");
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
          placeholder="crm_followup_leads"
          className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#25D366] transition"
          autoFocus
        />
        <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}
          className="w-[110px] px-2 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#25D366] transition">
          <option value="en">en</option>
          <option value="en_US">en_US</option>
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
          className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] text-white text-[12px] font-semibold disabled:opacity-40 transition shrink-0"
        >
          {loading ? "…" : "Re-engage"}
        </button>
      </div>
      {error && <p className="text-[11px] text-[#DC2626]">⚠ {error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── BLAST TAB ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function BlastTab({ leads, authHeaders }) {
  const [templateName, setTemplateName] = useState("crm_followup_leads");
  const [languageCode, setLanguageCode]  = useState("en");
  const [loading, setLoading]            = useState(false);
  const [result,  setResult]             = useState(null);
  const [error,   setError]              = useState("");

  const handleBlast = async () => {
    if (!templateName.trim()) return setError("Template name is required");
    if (leads.length === 0) return setError("You have no assigned leads to send to");
    if (!window.confirm(`Send "${templateName}" to all ${leads.length} of your assigned leads? This cannot be undone.`)) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/employee-bulk-send`,
        { templateName: templateName.trim(), languageCode },
        authHeaders
      );
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Failed to send blast");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#F0F4FF] dark:bg-[#0B141A] p-6">
        <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center shadow-lg">
          <div className="w-14 h-14 rounded-full bg-[#f0fdf4] dark:bg-[#052e1c] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">WhatsApp Blast Sent!</h2>
          <p className="text-[12px] text-[#8B92A9] mb-5">Your template messages were dispatched to your leads.</p>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Sent",   value: result.sent   ?? 0, color: "#25D366" },
              { label: "Failed", value: result.failed ?? 0, color: "#DC2626" },
              { label: "Total",  value: result.total  ?? 0, color: "#2563EB" },
            ].map((s) => (
              <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 text-center border border-[#E4E7EF] dark:border-[#262A38]">
                <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-[#8B92A9] uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setResult(null); setTemplateName("crm_followup_leads"); }}
            className="w-full py-2.5 rounded-xl bg-[#25D366] text-white text-[13px] font-semibold hover:bg-[#1da851] transition"
          >
            Send Another Blast
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start gap-0 bg-[#F0F4FF] dark:bg-[#0B141A] overflow-y-auto p-6">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-6 mb-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] dark:bg-[#052e1c] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">WhatsApp Template Blast</h2>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Send a template to all your assigned leads</p>
            </div>
          </div>

          <div className="bg-[#F0FDF4] dark:bg-[#052e1c]/50 border border-[#BBF7D0] dark:border-[#14532D] rounded-xl px-4 py-3 flex items-center gap-3 mb-5">
            <svg className="w-5 h-5 text-[#16A34A] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-[13px] font-semibold text-[#16A34A]">{leads.length} leads will receive this message</p>
              <p className="text-[11px] text-[#4ADE80] dark:text-[#86EFAC]">Only your assigned leads — no one else's</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. crm_followup_leads"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#25D366]"
            />
            <p className="text-[10px] text-[#8B92A9] mt-1">Must match exactly the approved template name in your MSG91 / Meta dashboard</p>
          </div>

          <div className="mb-5">
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Template Language</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#25D366]"
            >
              <option value="en">English (en)</option>
              <option value="en_US">English US (en_US)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="mr">Marathi (mr)</option>
              <option value="gu">Gujarati (gu)</option>
              <option value="ta">Tamil (ta)</option>
              <option value="te">Telugu (te)</option>
              <option value="kn">Kannada (kn)</option>
            </select>
          </div>

          <div className="bg-[#EFF6FF] dark:bg-[#1E3A5F]/30 border border-[#BFDBFE] dark:border-[#1D4ED8]/30 rounded-xl px-4 py-3 text-[11px] text-[#2563EB] dark:text-[#93C5FD] mb-5">
            <strong>How it works:</strong> WhatsApp requires a pre-approved template to initiate conversations. The template is sent to all your assigned leads with a valid mobile number.
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleBlast}
            disabled={loading || !templateName.trim() || leads.length === 0}
            className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1da851] disabled:opacity-40 text-white text-[13px] font-bold transition flex items-center justify-center gap-2 shadow-md"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending to {leads.length} leads…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
                Send "{templateName}" to {leads.length} leads
              </>
            )}
          </button>
        </div>

        {leads.length > 0 && (
          <div className="bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
              <p className="text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Leads that will receive the blast</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {leads.map((lead) => (
                <div key={lead._id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#F0F2F5] dark:border-[#262A38] last:border-0">
                  <Avatar name={lead.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#E9EDEF] truncate">{lead.name}</p>
                    <p className="text-[11px] text-[#8B92A9] truncate">{lead.mobile || lead.phone}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    lead.status === "Converted"   ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                    lead.status === "In Progress" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                                                    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  }`}>
                    {lead.status || "New"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── START CONVERSATION PANE ───────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function StartConversationPane({ lead, authHeaders, apiUrl, onStarted }) {
  const [templateName, setTemplateName] = useState("crm_followup_leads");
  const [langCode,     setLangCode]     = useState("en");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");

  const handleStart = async () => {
    if (!templateName.trim()) return setError("Template name is required");
    setLoading(true); setError("");
    try {
      const phone = (lead.mobile || lead.phone || "").replace(/\D/g, "");
      const { data } = await axios.post(
        `${apiUrl}/whatsapp/start-conversation`,
        { phone, contactName: lead.name, templateName: templateName.trim(), languageCode: langCode },
        authHeaders
      );
      onStarted(data.conversation);
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || "Failed to start conversation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#F0F4FF] dark:bg-[#0B141A] p-6">
      <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-[14px] font-bold text-[#4B5168] dark:text-[#8B92A9]">No WhatsApp conversation yet</h3>
      <p className="text-[11px] text-[#8B92A9] text-center max-w-xs">
        Send the first template message to start a conversation with <strong>{lead.name}</strong>.
      </p>

      <div className="w-full max-w-sm bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-5 shadow-sm">
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
            Template Name <span className="text-red-500">*</span>
          </label>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. crm_followup_leads"
            className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#25D366] transition"
          />
          <p className="text-[10px] text-[#8B92A9] mt-1">Must match exactly the approved template name in MSG91</p>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">Language</label>
          <select
            value={langCode}
            onChange={(e) => setLangCode(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#25D366] transition"
          >
            <option value="en">English (en)</option>
            <option value="en_US">English US (en_US)</option>
            <option value="hi">Hindi (hi)</option>
            <option value="mr">Marathi (mr)</option>
            <option value="gu">Gujarati (gu)</option>
          </select>
        </div>

        {error && <p className="text-[11px] text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading || !templateName.trim()}
          className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1da851] disabled:opacity-40 text-white text-[13px] font-semibold transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
          {loading ? "Sending…" : "Send Template & Start Chat"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function UserLeadCommunication() {
  const user        = JSON.parse(localStorage.getItem("user") || "null");
  const token       = localStorage.getItem("token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("chat");

  // ── Shared leads ─────────────────────────────────────────────────────────
  const [leads,        setLeads]        = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  // ── Chat tab state ────────────────────────────────────────────────────────
  const [selected,          setSelected]          = useState(null);   // selected Lead doc
  const [conversation,      setConversation]      = useState(null);   // { _id, sessionExpiresAt, status, waPhone }
  const [messages,          setMessages]          = useState([]);
  const [loadingMsgs,       setLoadingMsgs]       = useState(false);
  const [loadingConv,       setLoadingConv]       = useState(false);
  const [msgText,           setMsgText]           = useState("");
  const [sending,           setSending]           = useState(false);
  const [sendError,         setSendError]         = useState("");
  const [search,            setSearch]            = useState("");
  // unread counts keyed by lead._id
  const [unreadCounts,      setUnreadCounts]      = useState({});
  // maps conversationId (string) → lead._id (string) — built as leads are clicked
  const [convLeadMap,       setConvLeadMap]       = useState({});

  const socketRef      = useRef(null);
  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);

  // Stable refs so socket handlers never close over stale state
  const conversationRef  = useRef(null);   // full conversation object
  const selectedRef      = useRef(null);   // selected lead
  const convLeadMapRef   = useRef({});

  useEffect(() => { conversationRef.current  = conversation;  }, [conversation]);
  useEffect(() => { selectedRef.current      = selected;      }, [selected]);
  useEffect(() => { convLeadMapRef.current   = convLeadMap;   }, [convLeadMap]);

  // ── Fetch assigned leads ───────────────────────────────────────────────────
  useEffect(() => {
    api
      .get("/lead/my-leads")
      .then((res) => {
        const raw = res.data;
        setLeads(Array.isArray(raw) ? raw : raw?.leads || raw?.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingLeads(false));
  }, []);

  // ── Look up conversation when a lead is selected ─────────────────────────
  useEffect(() => {
    if (!selected?._id) {
      setConversation(null);
      setMessages([]);
      return;
    }
    setLoadingConv(true);
    setConversation(null);
    setMessages([]);
    setSendError("");
    axios
      .get(`${API_URL}/whatsapp/conversation-by-lead/${selected._id}`, authHeaders)
      .then((res) => {
        const conv = res.data?.conversation || null;
        if (conv) {
          const convIdStr = String(conv._id);
          setConversation(conv);
          // Build the map so socket handler can look up which lead a convId belongs to
          setConvLeadMap((prev) => ({ ...prev, [convIdStr]: selected._id }));
          // Clear unread badge for this lead
          setUnreadCounts((prev) => { const n = { ...prev }; delete n[selected._id]; return n; });
        } else {
          setConversation(null);
        }
      })
      .catch(() => setConversation(null))
      .finally(() => setLoadingConv(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?._id]);

  // ── Load messages once conversation is resolved ────────────────────────────
  useEffect(() => {
    if (!conversation?._id) return;
    setLoadingMsgs(true);
    axios
      .get(`${API_URL}/whatsapp/conversations/${conversation._id}/messages`, authHeaders)
      .then((res) => {
        const d = res.data;
        setMessages(Array.isArray(d) ? d : d?.messages || []);
        // Sync fresh conversation meta (sessionExpiresAt) from the messages endpoint
        if (d?.conversation) {
          setConversation((prev) => prev ? { ...prev, ...d.conversation } : d.conversation);
        }
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Socket — robust handler matching admin panel logic ────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true, auth: { token } });
    socketRef.current = socket;

    // ── DIAGNOSTIC LOGGING — remove once issue is confirmed fixed ────────────
    console.log("[WA-DEBUG] Socket initialising", { SOCKET_URL, hasToken: !!token, user });
    socket.on("connect",    () => console.log("[WA-DEBUG] socket connected, id=", socket.id));
    socket.on("disconnect", (r) => console.log("[WA-DEBUG] socket disconnected, reason=", r));
    socket.on("connect_error", (e) => console.error("[WA-DEBUG] socket connect_error:", e.message));

    // Join the company-wide WhatsApp room — the backend emits every inbound
    // and outbound for this company to `wa_company_<companyId>`, mirroring the
    // admin's `wa_admin` firehose. The existing wa_message handler below
    // already filters by whether the message belongs to one of MY leads.
    if (user?.company || user?.companyId) {
      const companyId = user.company || user.companyId;
      console.log("[WA-DEBUG] emitting wa_company_join", { companyId });
      socket.emit("wa_company_join", { companyId });
    } else {
      console.warn("[WA-DEBUG] NO company in user object — wa_company_join SKIPPED. user=", user);
    }
    // Keep the per-agent join too for any legacy emits still using that path
    if (user?._id) {
      console.log("[WA-DEBUG] emitting wa_agent_join", { agentId: user._id });
      socket.emit("wa_agent_join", { agentId: user._id });
    }

    // ── Inbound/outbound message handler ──────────────────────────────────────
    // Three cases, in order of priority:
    //
    //  1. Conv-ID matches the open conversation → append message directly.
    //
    //  2. Conv-ID does NOT match but the phone number matches the selected lead
    //     (duplicate-conversation edge case: webhook picked a different conv than
    //     the one the frontend loaded).
    //       2a. A conversation IS loaded → re-fetch messages from the webhook's
    //           conv and update the conversation reference so future events match.
    //       2b. No conversation loaded yet (race: lead just selected, API in flight)
    //           → append the message directly; the ref will catch up on next render.
    //
    //  3. Message is for a different lead entirely → increment its unread badge.
    //
    // IMPORTANT: normalizePhone() already compares the last-10 digits so
    // "9538281101" == "919538281101" and all common storage formats match.
    socket.on("wa_message", (payload) => {
      // ── DIAGNOSTIC LOGGING ──────────────────────────────────────────────
      console.log("[WA-DEBUG] wa_message RECEIVED:", payload);

      const {
        conversationId: incomingConvId,
        message: msg,
        sessionExpiresAt: newExpiry,
        waPhone: inboundPhone,
      } = payload;
      if (!msg) {
        console.warn("[WA-DEBUG] payload has no msg — dropping");
        return;
      }

      const currentConv = conversationRef.current;
      const currentLead = selectedRef.current;
      console.log("[WA-DEBUG] state at moment of event:", {
        incomingConvId,
        currentConvId:   currentConv?._id,
        currentLeadId:   currentLead?._id,
        currentLeadName: currentLead?.name,
        currentLeadPhone: currentLead?.mobile,
        inboundPhone,
        msgDirection: msg.direction,
      });

      // ── Case 1: Exact conversation ID match ──────────────────────────────
      if (currentConv && String(currentConv._id) === String(incomingConvId)) {
        console.log("[WA-DEBUG] Case 1 fired — appending msg to open chat");
        if (msg.direction === "inbound" && newExpiry) {
          setConversation((prev) =>
            prev ? { ...prev, sessionExpiresAt: newExpiry, status: "waiting" } : prev
          );
        }
        setMessages((prev) => {
          if (prev.some((m) => m._id && String(m._id) === String(msg._id))) {
            console.log("[WA-DEBUG] msg already in list (dedup) — skip");
            return prev;
          }
          return [...prev, msg];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        return;
      }

      // ── Case 2: Phone matches selected lead (ID mismatch / race condition) ─
      // NOTE: We intentionally do NOT restrict to direction === "inbound" here.
      // Outbound messages can also arrive via the company firehose for a
      // different conv ID (e.g. if two convs exist for the same phone), and
      // we want those to also update the open chat window.
      const phoneMatchesCurrentLead =
        inboundPhone &&
        currentLead?.mobile &&
        normalizePhone(currentLead.mobile) === normalizePhone(inboundPhone);

      if (phoneMatchesCurrentLead) {
        console.log("[WA-DEBUG] Case 2 fired — phone matches selected lead");
        if (currentConv && String(currentConv._id) !== String(incomingConvId)) {
          // Case 2a: Different conv ID → re-fetch from the authoritative conv
          axios
            .get(`${API_URL}/whatsapp/conversations/${incomingConvId}/messages`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then(({ data }) => {
              setMessages(data.messages || []);
              // Update conversation ref so Case 1 fires correctly going forward
              const incoming = data.conversation || {};
              setConversation((prev) =>
                prev
                  ? { ...prev, ...incoming, _id: incomingConvId }
                  : { ...incoming, _id: incomingConvId }
              );
              // Register the new conv→lead mapping
              setConvLeadMap((prev) => ({
                ...prev,
                [String(incomingConvId)]: currentLead._id,
              }));
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            })
            .catch(() => {});
        } else {
          // Case 2b: No conversation loaded yet → append directly
          setMessages((prev) => {
            if (prev.some((m) => m._id && String(m._id) === String(msg._id))) return prev;
            return [...prev, msg];
          });
          if (newExpiry) {
            setConversation((prev) =>
              prev ? { ...prev, sessionExpiresAt: newExpiry, status: "waiting" } : prev
            );
          }
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        return;
      }

      // ── Case 3: Message for a different lead — increment unread badge ──────
      if (msg.direction === "inbound") {
        console.log("[WA-DEBUG] Case 3 path — inbound for non-open conv");
        const leadId = convLeadMapRef.current[String(incomingConvId)];
        if (leadId) {
          console.log("[WA-DEBUG] Case 3a — convId mapped to lead, bumping badge", leadId);
          setUnreadCounts((prev) => ({ ...prev, [leadId]: (prev[leadId] || 0) + 1 }));
        } else if (inboundPhone) {
          setLeads((prevLeads) => {
            const matchedLead = prevLeads.find(
              (l) => normalizePhone(l.mobile || l.phone) === normalizePhone(inboundPhone)
            );
            if (matchedLead) {
              console.log("[WA-DEBUG] Case 3b — phone matched a lead in MY list:", matchedLead.name, matchedLead._id);
              setConvLeadMap((prev) => ({
                ...prev,
                [String(incomingConvId)]: matchedLead._id,
              }));
              setUnreadCounts((prev) => ({
                ...prev,
                [matchedLead._id]: (prev[matchedLead._id] || 0) + 1,
              }));
            } else {
              console.warn("[WA-DEBUG] Case 3c — inbound phone", inboundPhone, "matches NO lead in this employee's list. Lead is not assigned to this user.");
            }
            return prevLeads;
          });
        }
      } else {
        console.log("[WA-DEBUG] outbound msg for non-open conv — ignored on this screen");
      }
    });

    // ── Delivery status ticks ─────────────────────────────────────────────────
    const handleStatus = ({ waMessageId, status }) => {
      setMessages((prev) => prev.map((m) => m.waMessageId === waMessageId ? { ...m, status } : m));
    };
    socket.on("wa_message_status", handleStatus);
    socket.on("wa_status_update",  handleStatus); // legacy fallback

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty — socket lives for the lifetime of this page

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = msgText.trim();
    if (!text || !conversation?._id || sending) return;
    setSending(true);
    setSendError("");
    const optimistic = {
      _id: `opt_${Date.now()}`,
      direction: "outbound",
      body: text,
      messageType: "text",
      waTimestamp: new Date(),
      status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setMsgText("");
    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/send`,
        { conversationId: conversation._id, text },
        authHeaders
      );
      const sentMsg = data?.message || data;
      setMessages((prev) => prev.map((m) => m._id === optimistic._id ? { ...optimistic, ...sentMsg } : m));
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      const code = e.response?.data?.code;
      setSendError(
        code === "SESSION_EXPIRED"
          ? "24-hour session expired. Send a template to re-engage."
          : e.response?.data?.error || e.response?.data?.message || "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  }, [msgText, conversation, sending]);

  const filteredLeads = leads.filter(
    (l) =>
      (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.mobile || l.phone || "").includes(search)
  );

  const session = conversation?.sessionExpiresAt ? sessionBanner(conversation.sessionExpiresAt) : null;
  const isClosed = conversation?.status === "closed";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-[#111B21]">

      {/* ── Top tab bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-[#E4E7EF] dark:border-[#2A3942] shrink-0 bg-white dark:bg-[#111B21] px-4 pt-3">
        {[
          {
            key: "chat",
            label: "Chat",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            ),
          },
          {
            key: "blast",
            label: "WhatsApp Blast",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            ),
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold border-b-2 transition mr-1 ${
              activeTab === tab.key
                ? "border-[#25D366] text-[#25D366]"
                : "border-transparent text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#E9EDEF]"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.key === "blast" && leads.length > 0 && (
              <span className="ml-1 bg-[#25D366]/15 text-[#25D366] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {leads.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {activeTab === "blast" ? (
        <BlastTab leads={leads} authHeaders={authHeaders} />
      ) : (
        /* ── CHAT TAB ──────────────────────────────────────────────────── */
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel: leads list — hidden on mobile when chat is open */}
          <div className={`w-80 shrink-0 flex flex-col border-r border-[#E4E7EF] dark:border-[#2A3942] bg-white dark:bg-[#111B21] ${selected ? "hidden sm:flex" : "flex"}`}>
            <div className="px-4 pt-5 pb-3 border-b border-[#E4E7EF] dark:border-[#2A3942]">
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#E9EDEF] mb-3">My Lead Chats</h2>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search leads…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#2A3942] bg-[#F0F2F5] dark:bg-[#202C33] text-[13px] text-[#0F1117] dark:text-[#E9EDEF] placeholder:text-[#8B92A9] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingLeads ? (
                <div className="flex justify-center items-center h-32">
                  <svg className="w-5 h-5 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12 text-[12px] text-[#8B92A9]">
                  {search ? "No leads match your search" : "No leads assigned to you yet"}
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const isActive = selected?._id === lead._id;
                  const unread   = unreadCounts[lead._id] || 0;
                  return (
                    <button
                      key={lead._id}
                      onClick={() => {
                        setSelected(lead);
                        if (unread) setUnreadCounts((prev) => { const n = { ...prev }; delete n[lead._id]; return n; });
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-[#F0F2F5] dark:border-[#2A3942] ${
                        isActive ? "bg-[#EEF3FF] dark:bg-[#2A3942]" : "hover:bg-[#F8F9FC] dark:hover:bg-[#202C33]"
                      }`}
                    >
                      <Avatar name={lead.name} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${unread ? "font-bold text-[#0F1117] dark:text-white" : "font-semibold text-[#0F1117] dark:text-[#E9EDEF]"}`}>{lead.name}</p>
                        <p className="text-[11px] text-[#8B92A9] truncate">{lead.mobile || lead.phone}</p>
                      </div>
                      {unread > 0 ? (
                        <span className="bg-[#25D366] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0">
                          {unread}
                        </span>
                      ) : (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          lead.status === "Converted"   ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                          lead.status === "In Progress" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                                                          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        }`}>
                          {lead.status || "New"}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: chat */}
          {!selected ? (
            <EmptyPane />
          ) : loadingConv ? (
            <div className="flex-1 flex items-center justify-center bg-[#F0F4FF] dark:bg-[#0B141A]">
              <svg className="w-6 h-6 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : !conversation ? (
            <StartConversationPane
              lead={selected}
              authHeaders={authHeaders}
              apiUrl={API_URL}
              onStarted={(conv) => {
                if (!conv) return;
                const convIdStr = String(conv._id);
                setConversation(conv);
                setConvLeadMap((prev) => ({ ...prev, [convIdStr]: selected._id }));
                setMessages([]);
                // Fetch messages after start
                axios
                  .get(`${API_URL}/whatsapp/conversations/${conv._id}/messages`, authHeaders)
                  .then((res) => setMessages(res.data?.messages || []))
                  .catch(() => {});
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
            />
          ) : (
            <div className={`flex flex-col overflow-hidden ${selected ? "flex-1" : "hidden sm:flex flex-1"}`}>
              {/* Chat header */}
              <div className="bg-[#075E54] dark:bg-[#202C33] px-4 py-3 flex items-center gap-3 shrink-0">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelected(null)}
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white transition shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <Avatar name={selected.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-white leading-none truncate">{selected.name}</h3>
                  <p className="text-[11px] text-[#8FB8A8] mt-0.5">{selected.mobile || selected.phone}</p>
                </div>
                <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-semibold shrink-0">
                  {selected.status || "New"}
                </span>
              </div>

              {/* Session banner (24h expiry warning) */}
              {session && (
                <div className={`px-4 py-2 text-[11px] border-b border-[#E4E7EF] dark:border-[#2A3942] ${
                  session.expired ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#FFFBEB] text-[#D97706]"
                }`}>
                  ⚠️ {session.text}
                </div>
              )}

              {/* Closed conversation banner */}
              {isClosed && (
                <div className="px-4 py-2 text-[11px] bg-[#F8F9FC] dark:bg-[#1A1D27] text-[#8B92A9] border-b border-[#E4E7EF] dark:border-[#2A3942] text-center">
                  This conversation has been marked as resolved.
                </div>
              )}

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto py-3"
                style={{ background: "linear-gradient(to bottom, #f0fdf4 0%, #fafffe 100%)" }}
              >
                {loadingMsgs ? (
                  <div className="flex justify-center items-center h-full">
                    <svg className="w-6 h-6 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                    <svg className="w-12 h-12 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-[12px] text-[#8B92A9]">No messages yet — start the conversation</p>
                  </div>
                ) : (
                  messages.map((msg, i) => (
                    <Bubble
                      key={msg._id || i}
                      msg={msg}
                      isOwn={msg.direction === "outbound" || msg.from === "admin"}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Send error */}
              {sendError && (
                <div className="px-4 py-2 bg-[#FEF2F2] text-[#DC2626] text-[11px] border-t border-[#FECACA] flex items-center justify-between shrink-0">
                  {sendError}
                  <button onClick={() => setSendError("")} className="ml-2 text-inherit">✕</button>
                </div>
              )}

              {/* Input bar — show Re-engage when session expired, normal input otherwise */}
              {session?.expired && !isClosed ? (
                <div className="px-4 py-3 border-t border-[#E4E7EF] dark:border-[#2A3942] bg-white dark:bg-[#111B21] shrink-0">
                  <p className="text-[11px] text-[#8B92A9] mb-2 text-center">
                    24-hour session expired. Send a pre-approved template to re-open the conversation.
                  </p>
                  <ReEngageWidget
                    conversationId={conversation._id}
                    authHeaders={authHeaders}
                    onSent={(msg) => {
                      setMessages((prev) => [...prev, msg]);
                      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
                      setConversation((prev) => prev ? { ...prev, sessionExpiresAt: newExpiry, status: "open" } : prev);
                      setSendError("");
                    }}
                  />
                </div>
              ) : (
                <div className="bg-[#F0F2F5] dark:bg-[#202C33] px-3 py-2.5 flex items-end gap-2 shrink-0">
                  <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-2xl px-4 py-2 min-h-[42px] flex items-center">
                    <textarea
                      ref={inputRef}
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      placeholder={isClosed ? "Conversation is resolved" : "Type a message…"}
                      disabled={isClosed || sending}
                      className="w-full bg-transparent text-[13px] text-[#111B21] dark:text-[#E9EDEF] placeholder:text-[#8B92A9] resize-none focus:outline-none leading-relaxed disabled:opacity-50"
                      style={{ maxHeight: "100px", overflowY: "auto" }}
                    />
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !msgText.trim() || !conversation?._id || isClosed}
                    className="w-11 h-11 rounded-full bg-[#25D366] hover:bg-[#20B858] disabled:opacity-40 flex items-center justify-center transition shadow-md shrink-0"
                  >
                    {sending ? (
                      <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}