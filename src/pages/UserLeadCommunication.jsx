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
import { maskPhone } from "../utils/maskPhone";
import FeatureGate from "../components/FeatureGate";
import { Image as ImageIcon, FileText, Music, Video, ClipboardList, AlertTriangle, Target, Users, Smartphone } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL 
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
// ── Emoji palette for the composer picker ────────────────────────────────────
// Kept as a plain array so no extra npm dependency is needed.
const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","🤣","😂",
  "🙂","🙃","😉","😊","😇","🥰","😍","😘",
  "😋","😜","🤪","🤗","🤔","🤐","😐","😴",
  "😎","🥳","😏","😢","😭","😤","😡","🥺",
  "👍","👎","👌","🙏","👏","🙌","💪","🤝",
  "❤️","🧡","💛","💚","💙","💜","🔥","✨",
  "🎉","🎊","✅","❌","⚠️","❗","❓","💯",
  "📞","📱","📧","📄","📷","🎥","🕐","📍",
];

function Bubble({ msg, isOwn, onEdit, onRetryMedia }) {
  const status = msg.status;
  // Older inbound messages stored the URL in mediaId only, so fall back to it
  // when it looks like a URL — makes previously-received media render too.
  const rawMediaId = msg.mediaId || msg.media_id || null;
  const candidateUrl =
    msg.mediaUrl || msg.media_url ||
    (/^https?:\/\//i.test(String(rawMediaId || "")) ? rawMediaId : null);
  // Meta's lookaside URLs require an auth token and always 401 in the browser,
  // so never try to render them — the server mirrors them to a public URL and
  // pushes it via the wa_media_ready socket event.
  const isPrivateMetaUrl = /lookaside\.fbsbx\.com|graph\.facebook\.com/i.test(String(candidateUrl || ""));
  const url = isPrivateMetaUrl ? null : candidateUrl;
  const [mediaFailed, setMediaFailed] = useState(false);
  const [retryState,  setRetryState]  = useState(null); // null | 'loading' | 'failed'
  const type = msg.messageType;
  const isMedia = url && !mediaFailed && ["image", "video", "audio", "document"].includes(type);
  // For media, the body doubles as the caption/filename — only show it as a
  // caption when it adds information beyond the rendered media itself.
  const caption = msg.body || msg.text || msg.message || "";

  return (
    <div className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"} px-3`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-2xl text-[13px] shadow-sm ${
          isOwn
            ? "bg-[#DCF8C6] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] rounded-br-none"
            : "bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] rounded-bl-none border border-[#E4E7EF] dark:border-transparent"
        }`}
      >
        {isMedia ? (
          <div className="mb-1">
            {type === "image" && (
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={caption || "image"} onError={() => setMediaFailed(true)} className="rounded-lg max-h-60 w-auto object-cover cursor-pointer" />
              </a>
            )}
            {type === "video" && (
              <video src={url} controls playsInline className="rounded-lg max-h-60 w-full" />
            )}
            {type === "audio" && <audio src={url} controls className="w-56 max-w-full" />}
            {type === "document" && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-2 py-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition"
              >
                <FileText className="w-5 h-5 shrink-0" />
                <span className="truncate underline">{caption || "Document"}</span>
              </a>
            )}
            {caption && type !== "document" && (
              <p className="break-words leading-relaxed mt-1">{caption}</p>
            )}
          </div>
        ) : (
          <>
            {type === "image"    && <ImageIcon className="w-3.5 h-3.5 inline mr-1" />}
            {type === "document" && <FileText className="w-3.5 h-3.5 inline mr-1" />}
            {type === "audio"    && <Music className="w-3.5 h-3.5 inline mr-1" />}
            {type === "video"    && <Video className="w-3.5 h-3.5 inline mr-1" />}
            {type === "template" && <ClipboardList className="w-3.5 h-3.5 inline mr-1" />}
            <p className="break-words leading-relaxed inline">{caption}</p>
            {/* Attachment the lead sent that isn't viewable yet — offer a retry.
                WhatsApp hands us a private Meta link, so the server has to fetch
                and re-host it before it can be displayed. */}
            {!isOwn && ["image", "video", "audio", "document"].includes(type) && !url && onRetryMedia && (
              <button
                type="button"
                onClick={() => onRetryMedia(msg, setRetryState)}
                disabled={retryState === "loading"}
                className="block mt-1 text-[11px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
              >
                {retryState === "loading" ? "Loading…" : retryState === "failed" ? "Couldn't load — tap to retry" : "Tap to load attachment"}
              </button>
            )}
          </>
        )}
        <div className="flex items-center justify-end gap-1 mt-0.5">
          {msg.editedAt && (
            <span
              className="text-[10px] opacity-60 italic"
              title="Edited in the CRM only — the lead still sees the original message on their phone."
            >
              edited
            </span>
          )}
          {isOwn && onEdit && msg.messageType === "text" && !String(msg._id || "").startsWith("opt_") && (
            <button
              type="button"
              onClick={() => onEdit(msg)}
              title="Edit the CRM copy (the lead still sees the original)"
              className="text-[10px] opacity-50 hover:opacity-100 underline transition"
            >
              edit
            </button>
          )}
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
      {error && <p className="text-[11px] text-[#DC2626] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
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
                    <p className="text-[11px] text-[#8B92A9] truncate">{maskPhone(lead.mobile || lead.phone)}</p>
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
// ── SMS BLAST TAB (employee-scoped, mirrors admin SMS panel) ──────────────────
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_CLS_SMS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

const SKYUP_GREETINGS_TEMPLATE_ID_EMP = "6a1ffe028c6272147b00b233";
const SKYUP_GREETINGS_SENDER_ID_EMP   = "695382";
const SKYUP_GREETINGS_MESSAGE_EMP =
  "Hi {{name}}, thank you for contacting SKYUP Digital Solutions LLP!" +
  "Our Services:SEO ServicesSocial Media & GBP ManagementGoogle & Meta Ads" +
  "Website Design & DevelopmentAI Automation & Machine LearningChatbot & " +
  "WhatsApp AutomationOne of our team members will connect with you shortly." +
  "Phone: +91 88678 67775Website: SKYUP Digital Solutions LLP";

function SmsBlastTab() {
  const [mode,       setMode]       = useState("campaign");
  const [campaign,   setCampaign]   = useState("");
  const [singleLead, setSingleLead] = useState({ name: "", mobile: "" });
  const [csvText,    setCsvText]    = useState("name,mobile\nRahul Sharma,919876543210\nPriya Patel,919988776655");
  const [csvParsed,  setCsvParsed]  = useState(null);
  const [csvError,   setCsvError]   = useState("");
  const [message,    setMessage]    = useState("");
  const [templateId, setTemplateId] = useState(SKYUP_GREETINGS_TEMPLATE_ID_EMP);
  const [senderId,   setSenderId]   = useState(SKYUP_GREETINGS_SENDER_ID_EMP);
  const [leadCount,  setLeadCount]  = useState(null);
  const [campaigns,  setCampaigns]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [result,     setResult]     = useState(null);
  const [configured, setConfigured] = useState(null); // null = loading, true/false

  const MERGE_TAGS = ["{{name}}", "{{mobile}}", "{{email}}", "{{campaign}}"];
  const charCount  = message.length;
  const smsCount   = charCount === 0 ? 0 : Math.ceil(charCount / 160);

  // Load campaigns and SMS config status on mount
  useEffect(() => {
    api.get("/sms-campaign/employee/my-campaigns")
      .then((r) => setCampaigns(r.data.data || []))
      .catch(() => {});
    api.get("/sms-campaign/employee/config")
      .then((r) => setConfigured(r.data?.data?.isConfigured ?? false))
      .catch(() => setConfigured(false));
  }, []);

  // Preview lead count when campaign changes
  useEffect(() => {
    setLeadCount(null);
    if (mode === "campaign" && campaign) {
      api.get(`/sms-campaign/employee/preview?campaign=${encodeURIComponent(campaign)}`)
        .then((r) => setLeadCount(r.data.count))
        .catch(() => {});
    }
  }, [campaign, mode]);

  const parseCsv = () => {
    setCsvError(""); setCsvParsed(null);
    const lines = csvText.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return setCsvError("CSV needs a header row + at least one data row");
    const header    = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const mobileIdx = header.indexOf("mobile");
    if (mobileIdx === -1) return setCsvError("CSV must have a 'mobile' column");
    const nameIdx = header.indexOf("name");
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return { name: nameIdx !== -1 ? cols[nameIdx] : "Friend", mobile: cols[mobileIdx] };
    }).filter((r) => r.mobile && r.mobile.replace(/\D/g, "").length >= 10);
    if (rows.length === 0) return setCsvError("No valid mobile rows found (need 10+ digits)");
    setCsvParsed(rows);
  };

  const handleSend = async () => {
    if (!message.trim()) return setError("Message body is required");
    setLoading(true); setError("");
    try {
      let res;
      if (mode === "campaign") {
        if (!campaign) { setError("Please select a campaign"); setLoading(false); return; }
        if (!window.confirm(`Send SMS to ${leadCount ?? "?"} leads in "${campaign}"?`)) { setLoading(false); return; }
        res = await api.post("/sms-campaign/employee/send", { campaign, message, templateId: templateId || undefined, senderId: senderId || undefined });
      } else if (mode === "all") {
        if (!window.confirm(`Send SMS to ALL ${leadCount ?? "?"} of your assigned leads with a mobile number?`)) { setLoading(false); return; }
        res = await api.post("/sms-campaign/employee/send", { message, templateId: templateId || undefined, senderId: senderId || undefined });
      } else if (mode === "single") {
        if (!singleLead.mobile) { setError("Mobile number is required"); setLoading(false); return; }
        if (!window.confirm(`Send SMS to ${singleLead.name || singleLead.mobile}?`)) { setLoading(false); return; }
        res = await api.post("/sms-campaign/employee/send-single", { name: singleLead.name, mobile: singleLead.mobile, message, templateId: templateId || undefined, senderId: senderId || undefined });
      } else {
        if (!csvParsed) { setError("Parse your CSV first"); setLoading(false); return; }
        if (!window.confirm(`Send SMS to ${csvParsed.length} recipients from CSV?`)) { setLoading(false); return; }
        res = await api.post("/sms-campaign/employee/send-csv", { recipients: csvParsed, message, templateId: templateId || undefined, senderId: senderId || undefined });
      }
      setResult({ success: true, message: res.data.message, total: res.data.total });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Failed to send SMS");
    } finally { setLoading(false); }
  };

  // All-mode lead count preview
  useEffect(() => {
    if (mode === "all") {
      api.get("/sms-campaign/employee/preview")
        .then((r) => setLeadCount(r.data.count))
        .catch(() => {});
    }
  }, [mode]);

  const isValid = message.trim() && (
    mode === "campaign" ? !!campaign :
    mode === "all"      ? true :
    mode === "single"   ? !!singleLead.mobile :
    !!csvParsed
  );

  const recipientLabel =
    mode === "campaign" && leadCount !== null ? `${leadCount} leads` :
    mode === "all"      && leadCount !== null ? `${leadCount} leads` :
    mode === "single"   && singleLead.mobile  ? "1 recipient" :
    mode === "csv"      && csvParsed          ? `${csvParsed.length} recipients` : "recipients";

  const previewMsg = message
    .replace(/{{name}}/g, singleLead.name || "Rahul Sharma")
    .replace(/{{mobile}}/g, singleLead.mobile || "9876543210")
    .replace(/{{campaign}}/g, campaign || "Campaign")
    .replace(/{{email}}/g, "rahul@example.com");

  if (result) return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#EFEAE2] dark:bg-[#0B141A] gap-4">
      <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center mb-2">
        <svg className="w-10 h-10 text-[#25D366]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <h3 className="text-[18px] font-bold text-[#111B21] dark:text-[#E9EDEF]">SMS Blast Queued!</h3>
      <p className="text-[13px] text-[#667781] dark:text-[#8696A0] text-center max-w-xs">{result.message}</p>
      {result.total && (
        <div className="flex items-center gap-2 bg-white dark:bg-[#202C33] rounded-xl px-6 py-3 shadow-sm">
          <span className="text-[24px] font-bold text-[#EA580C]">{result.total}</span>
          <span className="text-[13px] text-[#667781] dark:text-[#8696A0]">messages queued</span>
        </div>
      )}
      <button
        onClick={() => setResult(null)}
        className="mt-2 px-6 py-2.5 rounded-full bg-[#EA580C] text-white text-[13px] font-semibold hover:bg-orange-700 transition"
      >
        Send Another
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-[#EFEAE2] dark:bg-[#0B141A] overflow-hidden">
      {/* Header */}
      <div className="bg-[#075E54] dark:bg-[#202C33] px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-[#EA580C] flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-white leading-none">New SMS Blast</h3>
          <p className="text-[11px] text-[#8FB8A8] mt-0.5">via MSG91 · DLT compliant · my leads only</p>
        </div>
        {configured === false && (
          <div className="ml-auto bg-[#DC2626]/20 text-[#FCA5A5] text-[10px] font-semibold px-2.5 py-1 rounded-lg">
            <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> SMS not configured — ask admin</span>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* DLT info */}
        <div className="flex justify-center">
          <div className="bg-[#FFF7C7] dark:bg-[#2A2519] rounded-lg px-4 py-2 max-w-sm text-center shadow-sm">
            <p className="text-[11px] text-[#7B6914] dark:text-[#CDB648] leading-relaxed">
              <ClipboardList className="w-3.5 h-3.5 inline mr-1" /> MSG91 requires a <strong>DLT Template ID</strong>. SMS is only sent to <strong>your assigned leads</strong>.
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="bg-white dark:bg-[#202C33] rounded-2xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] uppercase tracking-wide mb-2">Send to</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: "campaign", label: "My Campaign",   Icon: Target },
              { key: "all",      label: "All My Leads",  Icon: Users },
              { key: "single",   label: "Single Number", Icon: Smartphone },
              { key: "csv",      label: "CSV Upload",    Icon: FileText },
            ].map((m) => (
              <button key={m.key} onClick={() => setMode(m.key)}
                className={`py-2 px-2 rounded-xl text-[11px] font-semibold border transition ${
                  mode === m.key
                    ? "bg-[#FFF7ED] dark:bg-[#2D1000] border-[#EA580C] text-[#EA580C]"
                    : "border-[#E4E7EF] dark:border-[#2A3942] text-[#8B92A9] hover:border-[#EA580C] hover:text-[#EA580C]"
                }`}>
                <span className="inline-flex items-center gap-1"><m.Icon className="w-3.5 h-3.5" />{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific inputs */}
        <div className="bg-white dark:bg-[#202C33] rounded-2xl p-4 shadow-sm space-y-3">
          {mode === "campaign" && (
            <div>
              <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1.5">
                Campaign <span className="text-[#DC2626]">*</span>
              </label>
              <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={FIELD_CLS_SMS}>
                <option value="">— Select campaign —</option>
                {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {leadCount !== null && (
                <p className="text-[11px] text-[#8B92A9] mt-1">
                  <span className="font-bold text-[#EA580C]">{leadCount}</span> of your leads with mobile numbers
                </p>
              )}
            </div>
          )}

          {mode === "all" && (
            <div className="flex items-center gap-3 p-3 bg-[#FFF7ED] dark:bg-[#1c0a00] rounded-xl border border-[#FED7AA] dark:border-[#7c3a00]">
              <svg className="w-5 h-5 text-[#EA580C] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <p className="text-[12px] font-semibold text-[#EA580C]">
                  Blast to all your assigned leads
                </p>
                {leadCount !== null && (
                  <p className="text-[11px] text-[#9A3412] dark:text-[#FED7AA]">
                    <strong>{leadCount}</strong> leads with mobile numbers
                  </p>
                )}
              </div>
            </div>
          )}

          {mode === "single" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1.5">Recipient Name</label>
                <input type="text" value={singleLead.name} onChange={(e) => setSingleLead((p) => ({ ...p, name: e.target.value }))} placeholder="Rahul Sharma" className={FIELD_CLS_SMS} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1.5">Mobile <span className="text-[#DC2626]">*</span></label>
                <input type="tel" value={singleLead.mobile} onChange={(e) => setSingleLead((p) => ({ ...p, mobile: e.target.value }))} placeholder="919876543210" className={FIELD_CLS_SMS} />
              </div>
            </div>
          )}

          {mode === "csv" && (
            <div>
              <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1.5">Paste CSV (name, mobile) <span className="text-[#DC2626]">*</span></label>
              <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setCsvParsed(null); setCsvError(""); }} rows={4} className={FIELD_CLS_SMS + " font-mono text-[11px] resize-y"} />
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={parseCsv} className="px-3 py-1.5 rounded-lg bg-[#F1F5F9] dark:bg-[#2A3942] text-[11px] font-semibold text-[#4B5168] border border-[#E4E7EF] dark:border-[#2A3942] hover:border-[#EA580C] hover:text-[#EA580C] transition">Parse CSV</button>
                {csvParsed && <span className="text-[11px] text-[#059669] font-semibold">✓ {csvParsed.length} valid rows</span>}
                {csvError  && <span className="text-[11px] text-[#DC2626] inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {csvError}</span>}
              </div>
            </div>
          )}

          {/* MSG91 config fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#F1F5F9] dark:border-[#2A3942]">
            <div>
              <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1.5">DLT Template ID</label>
              <input type="text" value={templateId} onChange={(e) => setTemplateId(e.target.value)} placeholder="1234567890123456789" className={FIELD_CLS_SMS} />
              <p className="text-[10px] text-[#8B92A9] mt-0.5">MSG91 → DLT dashboard</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] mb-1.5">Sender ID</label>
              <input type="text" maxLength={6} value={senderId} onChange={(e) => setSenderId(e.target.value.toUpperCase())} placeholder="SKYCRM" className={FIELD_CLS_SMS} />
              <p className="text-[10px] text-[#8B92A9] mt-0.5">6-char DLT-approved</p>
            </div>
          </div>
        </div>

        {/* Message body */}
        <div className="bg-white dark:bg-[#202C33] rounded-2xl p-4 shadow-sm">
          {/* Quick-fill approved template */}
          <div className="mb-3 p-3 bg-[#FFF7ED] dark:bg-[#1c0a00] border border-[#FED7AA] dark:border-[#7c3a00] rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#EA580C] mb-0.5 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Approved Template</p>
              <p className="text-[10px] text-[#9A3412] dark:text-[#FED7AA] font-mono truncate">
                Sender: <strong>695382</strong> · DLT: <strong>1007503933418344595</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setTemplateId(SKYUP_GREETINGS_TEMPLATE_ID_EMP);
                setSenderId(SKYUP_GREETINGS_SENDER_ID_EMP);
                setMessage(SKYUP_GREETINGS_MESSAGE_EMP);
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[#EA580C] text-white text-[11px] font-bold hover:bg-orange-700 transition whitespace-nowrap"
            >
              Use Skyup_greetings
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-[#667781] dark:text-[#8696A0] uppercase tracking-wide">
              Message <span className="text-[#DC2626]">*</span>
            </label>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {MERGE_TAGS.map((tag) => (
                <button key={tag} onClick={() => setMessage((m) => m + tag)}
                  className="px-2 py-0.5 rounded-md bg-[#FFF7ED] dark:bg-[#1c0a00] text-[#EA580C] text-[10px] font-mono font-bold hover:opacity-80 transition">
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className={FIELD_CLS_SMS + " resize-y"}
            placeholder={`Hi {{name}}, this is a message from SkyUp CRM.`}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-[#8B92A9]">
              <span className={charCount > 160 ? "text-[#EA580C] font-bold" : ""}>{charCount}</span> chars ·{" "}
              <span className={smsCount > 1 ? "text-[#EA580C] font-bold" : ""}>{smsCount} SMS</span>/recipient
            </p>
            <p className="text-[10px] text-[#8B92A9]">→ <strong className="text-[#EA580C]">{recipientLabel}</strong></p>
          </div>
        </div>

        {/* Live preview */}
        {message.trim() && (
          <div>
            <p className="text-[10px] font-semibold text-[#667781] dark:text-[#8696A0] uppercase tracking-wide text-center mb-2">Preview</p>
            <div className="flex justify-end px-2">
              <div className="max-w-[75%] bg-[#DCF8C6] dark:bg-[#005C4B] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
                <p className="text-[13px] text-[#111B21] dark:text-[#E9EDEF] leading-relaxed whitespace-pre-wrap">{previewMsg}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-[#667781] dark:text-[#8696A0]">now</span>
                  <svg className="w-4 h-4 text-[#34B7F1]" viewBox="0 0 16 11" fill="currentColor">
                    <path d="M11.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.092-.013l-3-3.5a.75.75 0 1 1 1.14-.977l2.46 2.87 5.908-6.415a.75.75 0 0 1 1.059-.025z"/>
                    <path d="M14.071.653a.75.75 0 0 1 .025 1.06l-6.5 7a.75.75 0 0 1-1.085.013L4.54 6.653a.75.75 0 0 1 1.14-.977l1.502 1.752 5.83-6.75a.75.75 0 0 1 1.059-.025z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>
        )}
      </div>

      {/* Send bar */}
      <div className="bg-[#F0F2F5] dark:bg-[#202C33] px-4 py-3 flex items-center gap-3 shrink-0 border-t border-[#E4E7EF] dark:border-[#2A3942]">
        <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-full px-4 py-2.5 text-[12px] text-[#667781] dark:text-[#8696A0] select-none">
          {message.trim()
            ? <span className="text-[#111B21] dark:text-[#E9EDEF] truncate block">{message.slice(0, 60)}{message.length > 60 ? "…" : ""}</span>
            : "Compose your message above…"
          }
        </div>
        <button
          onClick={handleSend}
          disabled={loading || !isValid || configured === false}
          className="w-11 h-11 rounded-full bg-[#EA580C] hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shadow-md"
          title={configured === false ? "SMS not configured — ask admin to set up MSG91" : "Send SMS Blast"}
        >
          {loading
            ? <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            : <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

// ── SMS DIRECT MESSAGING TAB ──────────────────────────────────────────────────
// WhatsApp-style layout: leads list left, SMS thread right, compose at bottom.
// Uses the same lead list as other tabs (passed as prop) and calls the new
// /api/sms-campaign/employee/thread + /send-single backend endpoints.
// ─────────────────────────────────────────────────────────────────────────────

function SmsChatBubble({ log }) {
  const ts = log.sentAt ? new Date(log.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
  const isOk = log.status === "sent";
  return (
    <div className="flex justify-end px-3 mb-2">
      <div className="max-w-[75%] px-3 py-2 rounded-2xl rounded-br-none text-[13px] shadow-sm bg-[#DCF8C6] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF]">
        <p className="break-words leading-relaxed">{log.message}</p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <p className="text-[10px] opacity-50">{ts}</p>
          <span className={`text-[10px] ${isOk ? "text-[#2563eb]" : "text-red-400"}`}>
            {isOk ? "✓" : "✗"}
          </span>
        </div>
      </div>
    </div>
  );
}

function SmsChatTab({ leads, loadingLeads }) {
  const [selected,    setSelected]    = useState(null);
  const [thread,      setThread]      = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [msgText,     setMsgText]     = useState("");
  const [sending,     setSending]     = useState(false);
  const [sendErr,     setSendErr]     = useState("");
  const [search,      setSearch]      = useState("");
  const [configured,  setConfigured]  = useState(null); // null=unknown, true/false
  const bottomRef = useRef(null);

  // Load config status once
  useEffect(() => {
    api.get("/sms-campaign/employee/config")
      .then(r => setConfigured(r.data?.data?.isConfigured ?? false))
      .catch(() => setConfigured(false));
  }, []);

  // Load thread whenever a lead is selected
  useEffect(() => {
    if (!selected?.mobile) { setThread([]); return; }
    setLoadingThread(true);
    api.get(`/sms-campaign/employee/thread?mobile=${encodeURIComponent(selected.mobile)}`)
      .then(r => setThread(Array.isArray(r.data?.data) ? r.data.data : []))
      .catch(() => setThread([]))
      .finally(() => setLoadingThread(false));
  }, [selected]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const handleSend = async () => {
    if (!msgText.trim() || !selected?.mobile) return;
    setSending(true);
    setSendErr("");
    try {
      await api.post("/sms-campaign/employee/send-single", {
        mobile: selected.mobile,
        name:   selected.name,
        message: msgText.trim(),
      });
      // Optimistically add to thread
      setThread(prev => [...prev, {
        _id:           Date.now(),
        message:       msgText.trim(),
        to:            selected.mobile,
        recipientName: selected.name,
        status:        "sent",
        sentAt:        new Date().toISOString(),
      }]);
      setMsgText("");
    } catch (err) {
      setSendErr(err.response?.data?.message || "Failed to send SMS");
    } finally {
      setSending(false);
    }
  };

  const filteredLeads = leads.filter(l =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) || l.mobile?.includes(search)
  );

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Left panel: leads list ── */}
      <div className={`w-80 shrink-0 flex flex-col border-r border-[#E4E7EF] dark:border-[#2A3942] bg-white dark:bg-[#111B21] ${selected ? "hidden sm:flex" : "flex"}`}>
        <div className="px-4 pt-5 pb-3 border-b border-[#E4E7EF] dark:border-[#2A3942]">
          <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#E9EDEF] mb-3">SMS Direct</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F0F2FA] dark:bg-[#202C33] text-[13px] text-[#0F1117] dark:text-[#E9EDEF] placeholder:text-[#8B92A9] focus:outline-none border border-transparent focus:border-[#EA580C]/40 transition"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingLeads ? (
            <div className="flex items-center justify-center py-10 text-[#8B92A9] text-[13px]">Loading…</div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#8B92A9]">
              <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <p className="text-[12px]">No leads found</p>
            </div>
          ) : (
            filteredLeads.map(lead => {
              const hasMobile = !!lead.mobile;
              const isActive  = selected?._id === lead._id;
              return (
                <button
                  key={lead._id}
                  onClick={() => { setSelected(lead); setMsgText(""); setSendErr(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#E4E7EF]/50 dark:border-[#2A3942]/50 hover:bg-[#F0F2FA] dark:hover:bg-[#202C33] transition ${isActive ? "bg-[#FFF3ED] dark:bg-[#EA580C]/10" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0 ${isActive ? "bg-[#EA580C]" : "bg-[#6B7280]"}`}>
                    {(lead.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#E9EDEF] truncate">{lead.name || "Unknown"}</p>
                    <p className={`text-[11px] truncate ${hasMobile ? "text-[#8B92A9]" : "text-amber-500"}`}>
                      {hasMobile ? maskPhone(lead.mobile) : "No mobile number"}
                    </p>
                  </div>
                  {!hasMobile && (
                    <span className="shrink-0 text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-1.5 py-0.5 rounded-full">NO#</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: SMS thread ── */}
      <div className="flex-1 flex flex-col bg-[#F0F2FA] dark:bg-[#0A1A20] min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#8B92A9]">
            <div className="w-16 h-16 rounded-full bg-[#EA580C]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#EA580C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">Select a lead to start SMS messaging</p>
            <p className="text-[12px] text-center max-w-xs">You can only message your assigned leads. Individual SMS messages are sent directly to their mobile number.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1F2C33] border-b border-[#E4E7EF] dark:border-[#2A3942] shadow-sm">
              <button onClick={() => setSelected(null)} className="sm:hidden p-1 rounded-lg hover:bg-[#F0F2FA] dark:hover:bg-[#2A3942] text-[#8B92A9]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div className="w-10 h-10 rounded-full bg-[#EA580C] flex items-center justify-center text-[12px] font-bold text-white shrink-0">
                {(selected.name || "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#E9EDEF] truncate">{selected.name}</p>
                <p className="text-[11px] text-[#8B92A9]">{maskPhone(selected.mobile) || "No mobile"} · SMS</p>
              </div>
              {configured === false && (
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-semibold">SMS not configured</span>
              )}
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto py-4">
              {loadingThread ? (
                <div className="flex items-center justify-center py-10 text-[#8B92A9] text-[13px]">Loading messages…</div>
              ) : thread.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#8B92A9]">
                  <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                  </svg>
                  <p className="text-[12px]">No messages yet. Send the first SMS below.</p>
                </div>
              ) : (
                thread.map(log => <SmsChatBubble key={log._id} log={log} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Compose */}
            <div className="bg-white dark:bg-[#1F2C33] border-t border-[#E4E7EF] dark:border-[#2A3942] px-4 py-3">
              {!selected.mobile ? (
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <p className="text-[12px] text-amber-700 dark:text-amber-400">This lead has no mobile number — cannot send SMS.</p>
                </div>
              ) : (
                <>
                  {sendErr && (
                    <p className="text-[11px] text-red-500 mb-2 px-1">{sendErr}</p>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={msgText}
                      onChange={e => setMsgText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type an SMS message…"
                      rows={2}
                      disabled={sending || configured === false}
                      className="flex-1 px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#EA580C]/60 transition resize-none"
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !msgText.trim() || configured === false}
                      className="w-11 h-11 rounded-full bg-[#EA580C] hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shadow-md shrink-0"
                      title={configured === false ? "SMS not configured" : "Send SMS"}
                    >
                      {sending
                        ? <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                        : <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-[#8B92A9] mt-1.5 px-1">
                    {msgText.length} chars · {msgText.length === 0 ? 0 : Math.ceil(msgText.length / 160)} SMS segment{Math.ceil(msgText.length / 160) !== 1 ? "s" : ""} · Press Enter to send
                  </p>
                </>
              )}
            </div>
          </>
        )}
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
  // ── Attachments (+ menu) & emoji picker ────────────────────────────────────
  const [showAttachMenu,    setShowAttachMenu]    = useState(false);
  const [showEmoji,         setShowEmoji]         = useState(false);
  const [uploading,         setUploading]         = useState(false);
  const imageInputRef = useRef(null);   // photos & videos
  const docInputRef   = useRef(null);   // any document
  const gifInputRef   = useRef(null);   // .gif files
  // ── Edit an already-sent message (CRM copy only) ───────────────────────────
  const [editingMsg,  setEditingMsg]  = useState(null); // the message being edited
  const [editText,    setEditText]    = useState("");
  const [savingEdit,  setSavingEdit]  = useState(false);
  // Lets the employee manually open the "Send Template" panel any time —
  // not just when the session banner detects an expired session. This also
  // covers the case where a conversation has NEVER had a session opened yet
  // (sessionExpiresAt is null, e.g. a fresh template-only conversation) —
  // previously that state fell through to the plain text box, which just
  // failed silently on send with a SESSION_EXPIRED error.
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [search,            setSearch]            = useState("");
  // unread counts keyed by lead._id
  const [unreadCounts,      setUnreadCounts]      = useState({});
  // Total unread inbound messages across all of this agent's leads (header badge)
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + (b || 0), 0);
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

  // ── Seed the red unread badges from the server ──────────────────────────────
  // The badge shows how many messages the LEAD sent that this agent hasn't
  // opened yet. The count is stored on the conversation in the DB (incremented
  // by the inbound WhatsApp webhook, cleared only when the agent opens that
  // lead's chat), so it survives page reloads/navigation and is completely
  // independent of the notification bell — clearing notifications never
  // changes these numbers.
  useEffect(() => {
    if (!leads.length) return;
    api
      .get("/whatsapp/unread-counts")
      .then(({ data }) => {
        const byLead  = data?.byLead  || {};
        const byPhone = data?.byPhone || {};
        const next = {};
        for (const l of leads) {
          const id  = String(l._id);
          const p10 = normalizePhone(l.mobile || l.phone || l.primaryPhone || "");
          const n   = byLead[id] || (p10 ? byPhone[p10] : 0) || 0;
          if (n > 0) next[id] = n;
        }
        setUnreadCounts(next);
      })
      .catch(() => {});
  }, [leads]);

  // ── Mark the open conversation as read ──────────────────────────────────────
  // Clears the stored unread count server-side. Called when a chat is opened AND
  // whenever a message arrives while that chat is already on screen — otherwise
  // the badge kept reappearing (the agent had clearly read the message, but the
  // server counter was never reset, so it came back on the next refresh).
  const markRead = useCallback((conversationId) => {
    if (!conversationId) return;
    axios
      .post(`${API_URL}/whatsapp/conversations/${conversationId}/mark-read`, {}, authHeaders)
      .then(() => {
        try { window.dispatchEvent(new Event("wa_unread_refresh")); } catch (_) {}
      })
      .catch(() => {});
  }, []);

  // ── Opening a chat clears its red badge immediately ─────────────────────────
  // Runs for EVERY path that opens a lead — clicking the list, and auto-opening
  // from a notification redirect. Previously only the click path cleared it, so
  // arriving via a notification left the badge until a page refresh.
  useEffect(() => {
    const id = selected?._id;
    if (!id) return;
    setUnreadCounts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // The backend clears the stored unreadCount when the conversation loads;
    // give it a beat, then have the sidebar badge re-count.
    const t = setTimeout(() => {
      try { window.dispatchEvent(new Event("wa_unread_refresh")); } catch (_) {}
    }, 1000);
    return () => clearTimeout(t);
  }, [selected?._id]);

  // Whenever a conversation is on screen, it is being read — clear its count.
  useEffect(() => {
    if (conversation?._id) markRead(conversation._id);
  }, [conversation?._id, markRead]);

  // ── Auto-open a lead when arriving from a notification (?leadId=...) ─────────
  // Clicking a "New WhatsApp reply" notification navigates here with
  // ?leadId=<id>; once the assigned leads load we select that lead so its chat
  // opens directly. The query param is then cleared so a refresh won't re-open.
  useEffect(() => {
    if (!leads.length) return;
    let wantedId = null;
    try { wantedId = new URLSearchParams(window.location.search).get("leadId"); } catch { wantedId = null; }
    if (!wantedId) return;
    const match = leads.find((l) => String(l._id) === String(wantedId));
    if (match) {
      setSelected(match);
      setMsgText("");
      setSendError("");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [leads]);

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
    setShowTemplatePanel(false);
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
        leadId: incomingLeadId,
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
        incomingLeadId,
        currentConvId:   currentConv?._id,
        currentLeadId:   currentLead?._id,
        currentLeadName: currentLead?.name,
        currentLeadPhone: currentLead?.mobile,
        inboundPhone,
        msgDirection: msg.direction,
      });

      // ── Case 0: leadId matches the open lead (most reliable — no phone/conv
      // matching needed, immune to masked numbers and duplicate conversations) ─
      if (incomingLeadId && currentLead?._id && String(incomingLeadId) === String(currentLead._id)) {
        console.log("[WA-DEBUG] Case 0 fired — inbound belongs to the OPEN lead");
        // The agent is looking at this chat, so it is read the moment it lands.
        if (msg.direction === "inbound") markRead(incomingConvId);
        // If the open conversation is a different record than where the message
        // landed, re-fetch from the authoritative conversation so the full
        // thread (including this message) shows.
        if (!currentConv || String(currentConv._id) !== String(incomingConvId)) {
          axios
            .get(`${API_URL}/whatsapp/conversations/${incomingConvId}/messages`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then(({ data }) => {
              setMessages(data.messages || []);
              const incoming = data.conversation || {};
              setConversation((prev) =>
                prev ? { ...prev, ...incoming, _id: incomingConvId } : { ...incoming, _id: incomingConvId }
              );
              setConvLeadMap((prev) => ({ ...prev, [String(incomingConvId)]: currentLead._id }));
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            })
            .catch(() => {});
        } else {
          if (msg.direction === "inbound" && newExpiry) {
            setConversation((prev) => prev ? { ...prev, sessionExpiresAt: newExpiry, status: "waiting" } : prev);
          }
          setMessages((prev) => {
            if (prev.some((m) => m._id && String(m._id) === String(msg._id))) return prev;
            return [...prev, msg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
        return;
      }

      // ── Case 1: Exact conversation ID match ──────────────────────────────
      if (currentConv && String(currentConv._id) === String(incomingConvId)) {
        console.log("[WA-DEBUG] Case 1 fired — appending msg to open chat");
        if (msg.direction === "inbound") markRead(incomingConvId);
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
      // Robust match: the lead's number may live under mobile / phone /
      // primaryPhone (and may be masked), so we compare the last-10 digits of
      // every available field against the inbound phone.
      const currentLeadPhones = [
        currentLead?.mobile,
        currentLead?.phone,
        currentLead?.primaryPhone,
        currentLead?.secondaryPhone,
      ].filter(Boolean);
      const phoneMatchesCurrentLead =
        inboundPhone &&
        currentLeadPhones.some(
          (p) => normalizePhone(p) && normalizePhone(p) === normalizePhone(inboundPhone)
        );

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
        const leadId = incomingLeadId || convLeadMapRef.current[String(incomingConvId)];
        if (leadId) {
          console.log("[WA-DEBUG] Case 3a — mapped to lead, bumping badge", leadId);
          setConvLeadMap((prev) => ({ ...prev, [String(incomingConvId)]: leadId }));
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

    // ── Inbound media became viewable ─────────────────────────────────────────
    // Media the lead sends arrives as a private Meta URL that can't be shown in
    // a browser. The server mirrors it to public storage and emits this event
    // with the usable URL — swap it in so the image/file appears without a
    // refresh.
    socket.on("wa_media_ready", ({ messageId, mediaUrl }) => {
      if (!messageId || !mediaUrl) return;
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(messageId) ? { ...m, mediaUrl } : m))
      );
    });

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

  // ── Send an attachment (photo / video / audio / document / GIF) ─────────────
  // The file is POSTed as multipart to /whatsapp/send-media; the backend uploads
  // it to Cloudinary (WhatsApp needs a public HTTPS URL) and forwards it to the
  // lead. Any text currently typed is used as the caption.
  const handleFilePicked = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file || !conversation?._id) return;

    // WhatsApp media ceiling is ~16MB (documents up to 100MB, but keep it safe).
    const MAX_MB = 16;
    if (file.size > MAX_MB * 1024 * 1024) {
      setSendError(`File is too large (${(file.size / 1048576).toFixed(1)}MB). WhatsApp allows up to ${MAX_MB}MB.`);
      return;
    }

    setShowAttachMenu(false);
    setUploading(true);
    setSendError("");

    const caption = msgText.trim();
    const isImg   = file.type.startsWith("image/") && file.type !== "image/gif";
    const optimistic = {
      _id: `opt_${Date.now()}`,
      direction: "outbound",
      body: caption || file.name,
      messageType: isImg ? "image" : file.type.startsWith("video/") || file.type === "image/gif" ? "video"
                   : file.type.startsWith("audio/") ? "audio" : "document",
      mediaUrl: isImg ? URL.createObjectURL(file) : null,
      waTimestamp: new Date(),
      status: "pending",
    };
    setMessages((prev) => [...prev, optimistic]);
    setMsgText("");
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversationId", conversation._id);
      if (caption) fd.append("caption", caption);

      const { data } = await axios.post(`${API_URL}/whatsapp/send-media`, fd, authHeaders);
      const sentMsg = data?.message || data;
      setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? { ...optimistic, ...sentMsg } : m)));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      const code = err.response?.data?.code;
      setSendError(
        code === "SESSION_EXPIRED"
          ? "24-hour session expired. Send a template to re-engage before sending files."
          : err.response?.data?.error || "Failed to send attachment"
      );
    } finally {
      setUploading(false);
    }
  }, [conversation, msgText]);

  // Insert an emoji at the end of the current message text.
  const addEmoji = useCallback((emo) => {
    setMsgText((prev) => prev + emo);
    inputRef.current?.focus();
  }, []);

  // ── Retry loading a lead-sent attachment ────────────────────────────────────
  // WhatsApp gives us a private Meta link that a browser can't open, so the
  // server must download and re-host it. If that failed on arrival, this lets
  // the agent retry from the chat and surfaces the real reason on failure.
  const retryMedia = useCallback(async (msg, setRetryState) => {
    if (!msg?._id) return;
    setRetryState("loading");
    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/messages/${msg._id}/refresh-media`,
        {},
        authHeaders
      );
      if (data?.mediaUrl) {
        setMessages((prev) =>
          prev.map((m) => (String(m._id) === String(msg._id) ? { ...m, mediaUrl: data.mediaUrl } : m))
        );
        setRetryState(null);
      } else {
        setRetryState("failed");
      }
    } catch (err) {
      setRetryState("failed");
      setSendError(err.response?.data?.error || "Couldn't load this attachment");
    }
  }, []);

  // ── Edit a sent message (CRM copy only) ─────────────────────────────────────
  const startEditMessage = useCallback((msg) => {
    setEditingMsg(msg);
    setEditText(msg.body || "");
  }, []);

  const saveEditMessage = useCallback(async () => {
    const text = editText.trim();
    if (!editingMsg?._id || !text || savingEdit) return;
    setSavingEdit(true);
    try {
      const { data } = await axios.patch(
        `${API_URL}/whatsapp/messages/${editingMsg._id}`,
        { text },
        authHeaders
      );
      const updated = data?.message || {};
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(editingMsg._id)
            ? { ...m, body: text, editedAt: updated.editedAt || new Date(), originalBody: updated.originalBody ?? m.originalBody ?? m.body }
            : m
        )
      );
      setEditingMsg(null);
      setEditText("");
    } catch (err) {
      setSendError(err.response?.data?.error || "Failed to edit message");
    } finally {
      setSavingEdit(false);
    }
  }, [editText, editingMsg, savingEdit]);

  const filteredLeads = leads
    .filter(
      (l) =>
        (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (l.mobile || l.phone || "").includes(search)
    )
    // Pin leads with unread inbound messages (the red badge) to the top of the
    // list, highest unread count first. Array.prototype.sort is stable, so
    // leads with no unread messages keep their original server order below.
    // .filter() already returned a fresh array, so this does not mutate `leads`.
    .sort((a, b) => (unreadCounts[b._id] || 0) - (unreadCounts[a._id] || 0));

  const session = conversation?.sessionExpiresAt ? sessionBanner(conversation.sessionExpiresAt) : null;
  const isClosed = conversation?.status === "closed";
  // A session is only "open" (free-form text allowed) when sessionExpiresAt
  // exists AND is in the future. Previously the input bar only switched to
  // the template/Re-engage UI when `session?.expired` was true — but
  // `sessionBanner()` returns null (not {expired:true}) when sessionExpiresAt
  // is unset entirely, which is exactly the state a brand-new template-only
  // conversation is in. That made the UI show a normal-looking text box that
  // would just fail with "SESSION_EXPIRED" on send. Gate on sessionOpen
  // instead so both cases (never opened / expired) show the template UI.
  const sessionOpen = !!(conversation?.sessionExpiresAt && new Date(conversation.sessionExpiresAt) > new Date());

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
          {
            key: "sms",
            label: "SMS Blast",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            ),
          },
          {
            key: "sms-direct",
            label: "SMS Chat",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
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
            {tab.key === "sms" && (
              <span className="ml-1 bg-[#EA580C]/15 text-[#EA580C] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                SMS
              </span>
            )}
            {tab.key === "sms-direct" && (
              <span className="ml-1 bg-[#EA580C]/15 text-[#EA580C] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                NEW
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      {activeTab === "sms" ? (
        <FeatureGate featureKey="sms-blast"><SmsBlastTab /></FeatureGate>
      ) : activeTab === "sms-direct" ? (
        <SmsChatTab leads={leads} loadingLeads={loadingLeads} />
      ) : activeTab === "blast" ? (
        <FeatureGate featureKey="whatsapp-blast">
          <BlastTab leads={leads} authHeaders={authHeaders} />
        </FeatureGate>
      ) : (
        /* ── CHAT TAB ──────────────────────────────────────────────────── */
        <div className="flex flex-1 overflow-hidden">

          {/* Left panel: leads list — hidden on mobile when chat is open */}
          <div className={`w-80 shrink-0 flex flex-col border-r border-[#E4E7EF] dark:border-[#2A3942] bg-white dark:bg-[#111B21] ${selected ? "hidden sm:flex" : "flex"}`}>
            <div className="px-4 pt-5 pb-3 border-b border-[#E4E7EF] dark:border-[#2A3942]">
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#E9EDEF] mb-3 flex items-center gap-2">
                My Lead Chats
                {totalUnread > 0 && (
                  <span
                    title={`${totalUnread} unread message${totalUnread > 1 ? "s" : ""} from your leads`}
                    className="bg-[#EF4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm"
                  >
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                )}
              </h2>
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
                        // The backend clears this lead's unreadCount when the
                        // conversation loads — refresh the sidebar badge after that.
                        setTimeout(() => { try { window.dispatchEvent(new Event("wa_unread_refresh")); } catch (_) {} }, 1200);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-[#F0F2F5] dark:border-[#2A3942] ${
                        isActive ? "bg-[#EEF3FF] dark:bg-[#2A3942]" : "hover:bg-[#F8F9FC] dark:hover:bg-[#202C33]"
                      }`}
                    >
                      <Avatar name={lead.name} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] truncate ${unread ? "font-bold text-[#0F1117] dark:text-white" : "font-semibold text-[#0F1117] dark:text-[#E9EDEF]"}`}>{lead.name}</p>
                        <p className="text-[11px] text-[#8B92A9] truncate">{maskPhone(lead.mobile || lead.phone)}</p>
                      </div>
                      {unread > 0 ? (
                        <span
                          title={`${unread} unread message${unread > 1 ? "s" : ""} from this lead`}
                          className="bg-[#EF4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0 shadow-sm"
                        >
                          {unread > 99 ? "99+" : unread}
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
                  <p className="text-[11px] text-[#8FB8A8] mt-0.5">{maskPhone(selected.mobile || selected.phone)}</p>
                </div>
                <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-semibold shrink-0">
                  {selected.status || "New"}
                </span>
                {!isClosed && (
                  <button
                    onClick={() => setShowTemplatePanel((v) => !v)}
                    title="Send a WhatsApp template to this lead"
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-full shrink-0 flex items-center gap-1 transition ${
                      showTemplatePanel
                        ? "bg-white text-[#075E54]"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" /> Send Template
                  </button>
                )}
              </div>

              {/* Session banner (24h expiry warning) */}
              {session && (
                <div className={`px-4 py-2 text-[11px] border-b border-[#E4E7EF] dark:border-[#2A3942] ${
                  session.expired ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#FFFBEB] text-[#D97706]"
                }`}>
                  <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {session.text}</span>
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
                      onEdit={startEditMessage}
                      onRetryMedia={retryMedia}
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

              {/* Input bar — show template panel when there's no open session
                  (never-opened OR expired) OR the employee manually opened it
                  via the header button; normal input otherwise */}
              {(!sessionOpen || showTemplatePanel) && !isClosed ? (
                <div className="px-4 py-3 border-t border-[#E4E7EF] dark:border-[#2A3942] bg-white dark:bg-[#111B21] shrink-0">
                  <p className="text-[11px] text-[#8B92A9] mb-2 text-center">
                    {sessionOpen
                      ? "Session is open — you can also send a fresh template below."
                      : "24-hour session expired. Send a pre-approved template to re-open the conversation."}
                  </p>
                  <ReEngageWidget
                    conversationId={conversation._id}
                    authHeaders={authHeaders}
                    onSent={(msg) => {
                      setMessages((prev) => [...prev, msg]);
                      // IMPORTANT: sending a template does NOT open WhatsApp's
                      // 24h session — only the LEAD's reply does (this mirrors
                      // the backend, which intentionally leaves
                      // sessionExpiresAt untouched on a template send). The
                      // previous version of this code optimistically set
                      // sessionExpiresAt/status as if the session were now
                      // open, which flipped the UI to the plain text box even
                      // though the backend would still correctly reject a
                      // free-form send with SESSION_EXPIRED. Keep status as
                      // "waiting" and leave sessionExpiresAt alone so the UI
                      // stays consistent with what the backend will actually
                      // allow, until the lead's inbound reply arrives via
                      // socket and opens the session for real.
                      setConversation((prev) => prev ? { ...prev, status: "waiting", lastMessage: msg.body, lastMessageAt: msg.waTimestamp || new Date() } : prev);
                      setSendError("");
                      setShowTemplatePanel(false);
                    }}
                  />
                  {sessionOpen && (
                    <button
                      onClick={() => setShowTemplatePanel(false)}
                      className="mt-2 text-[11px] text-[#8B92A9] hover:text-[#4B5168] underline w-full text-center"
                    >
                      Cancel — go back to typing a message
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-[#F0F2F5] dark:bg-[#202C33] px-3 py-2.5 flex items-end gap-2 shrink-0 relative">
                  {/* ── Edit message modal (CRM copy only) ── */}
                  {editingMsg && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#2A3942] shadow-2xl p-5">
                        <h3 className="text-[15px] font-bold text-[#111B21] dark:text-[#E9EDEF] mb-1">Edit message</h3>
                        <p className="text-[11px] text-[#B45309] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-2 mb-3 leading-relaxed">
                          ⚠ This edits the CRM record only. WhatsApp has no way to change a message
                          that was already delivered — <strong>the lead still sees the original text
                          on their phone.</strong> To correct something for the lead, send a new
                          follow-up message.
                        </p>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={4}
                          autoFocus
                          className="w-full rounded-xl border border-[#E4E7EF] dark:border-[#3B4A54] bg-white dark:bg-[#202C33] px-3 py-2 text-[13px] text-[#111B21] dark:text-[#E9EDEF] focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 resize-none"
                        />
                        <div className="flex items-center justify-end gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => { setEditingMsg(null); setEditText(""); }}
                            className="px-3 py-2 text-[13px] font-semibold text-[#4B5168] dark:text-[#AEBAC1] hover:underline"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveEditMessage}
                            disabled={savingEdit || !editText.trim()}
                            className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20B858] disabled:opacity-40 text-white text-[13px] font-semibold transition"
                          >
                            {savingEdit ? "Saving…" : "Save edit"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Hidden file inputs driven by the + menu */}
                  <input ref={imageInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFilePicked} />
                  <input ref={docInputRef}   type="file" className="hidden" onChange={handleFilePicked}
                         accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/*,text/*" />
                  <input ref={gifInputRef}   type="file" accept="image/gif" className="hidden" onChange={handleFilePicked} />

                  {/* ── Emoji picker ── */}
                  {showEmoji && !isClosed && (
                    <div className="absolute bottom-16 left-3 z-30 w-72 max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-[#2A3942] shadow-2xl border border-[#E4E7EF] dark:border-[#3B4A54] p-2">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJIS.map((emo) => (
                          <button
                            key={emo}
                            type="button"
                            onClick={() => addEmoji(emo)}
                            className="text-[19px] leading-none p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition"
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── + attachment menu ── */}
                  {showAttachMenu && !isClosed && (
                    <div className="absolute bottom-16 left-3 z-30 w-56 rounded-xl bg-white dark:bg-[#2A3942] shadow-2xl border border-[#E4E7EF] dark:border-[#3B4A54] overflow-hidden">
                      {[
                        { label: "Photo or Video", icon: ImageIcon, ref: imageInputRef, hint: "JPG, PNG, MP4" },
                        { label: "GIF",            icon: Video,     ref: gifInputRef,   hint: "Sent as video so it animates" },
                        { label: "Document",       icon: FileText,  ref: docInputRef,   hint: "PDF, Word, Excel, ZIP…" },
                      ].map(({ label, icon: Icon, ref, hint }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => { setShowAttachMenu(false); ref.current?.click(); }}
                          className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[#F0F2F5] dark:hover:bg-[#202C33] transition"
                        >
                          <Icon className="w-4 h-4 mt-0.5 text-[#25D366] shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-[#111B21] dark:text-[#E9EDEF]">{label}</span>
                            <span className="block text-[10px] text-[#8B92A9] truncate">{hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* + button */}
                  <button
                    type="button"
                    title="Attach photo, video, GIF or document"
                    onClick={() => { setShowAttachMenu((v) => !v); setShowEmoji(false); }}
                    disabled={isClosed || sending || uploading}
                    className="w-10 h-10 rounded-full bg-white dark:bg-[#2A3942] hover:bg-[#E9EDEF] dark:hover:bg-[#3B4A54] disabled:opacity-40 flex items-center justify-center transition shrink-0 shadow-sm"
                  >
                    {uploading ? (
                      <svg className="w-4 h-4 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <span className={`text-[22px] leading-none text-[#54656F] dark:text-[#AEBAC1] transition-transform ${showAttachMenu ? "rotate-45" : ""}`}>+</span>
                    )}
                  </button>

                  {/* emoji button */}
                  <button
                    type="button"
                    title="Emoji"
                    onClick={() => { setShowEmoji((v) => !v); setShowAttachMenu(false); }}
                    disabled={isClosed || sending}
                    className="w-10 h-10 rounded-full bg-white dark:bg-[#2A3942] hover:bg-[#E9EDEF] dark:hover:bg-[#3B4A54] disabled:opacity-40 flex items-center justify-center transition shrink-0 shadow-sm text-[18px]"
                  >
                    🙂
                  </button>

                  <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-2xl px-4 py-2 min-h-[42px] flex items-center">
                    <textarea
                      ref={inputRef}
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      onFocus={() => { setShowEmoji(false); setShowAttachMenu(false); }}
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