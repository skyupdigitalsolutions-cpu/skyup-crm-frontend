import { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";
import { fetchAll, getRole, getStoredUser } from "../data/dataService";
import api from "../data/axiosConfig";
import { useDateFilter } from "../components/dataFilter";
import CRMEncryption from "../utils/CRMEncryption";

const crm = new CRMEncryption();

const CALL_LOGS_API = "/call-logs";

// ── FIX: Centralised backend root + audio URL helper ──────────────────────────
const BACKEND_ROOT = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, "")
  : "https://skyup-crm-backend.onrender.com";

// FIX 1: Force https to avoid mixed-content browser block
function audioUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  if (url.startsWith("https://")) return url;
  return `${BACKEND_ROOT}${url}`;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SOURCE_COLORS = {
  "Google Ads":   "#2563EB",
  "Campaign":     "#7C3AED",
  "Facebook Ads": "#0891B2",
  "Web Form":     "#059669",
  "Referral":     "#D97706",
};

const STATUS_STYLE = {
  "Converted":      { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#065F46] dark:text-[#34D399]" },
  "In Progress":    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#92400E] dark:text-[#FCD34D]" },
  "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#991B1B] dark:text-[#F87171]" },
  "New":            { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#1D4ED8] dark:text-[#4F8EF7]" },
};

const OUTCOME_STYLE = {
  "Not Interested": { bg: "bg-red-50 dark:bg-red-950/40",        text: "text-red-600 dark:text-red-400" },
  "Interested":     { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400" },
  "Call Back":      { bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400" },
  "No Answer":      { bg: "bg-gray-100 dark:bg-gray-900/40",      text: "text-gray-500 dark:text-gray-400" },
};

const ALL_SOURCES  = ["Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral"];
const ALL_STATUSES = ["Converted", "In Progress", "Not Interested", "New"];

let nextId = 100;

function todayAsCustomDate() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function daysSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-[12px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{label}</span>
      <span className="text-[28px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{value}</span>
      {sub && <span className={`text-[12px] font-medium ${accent}`}>{sub}</span>}
    </div>
  );
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3" />
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5 h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-64" />
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-64" />
      </div>
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-96" />
    </div>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ agents, onClose, onAdd }) {
  const today = todayAsCustomDate();
  const [form, setForm] = useState({
    name: "", phone: "", source: "Google Ads", campaign: "",
    agent: agents[0]?.name || "", status: "New", date: today, remark: "",
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: "" })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (!form.phone.trim()) e.phone = "Phone is required.";
    else if (!/^\d{10}$/.test(form.phone.trim())) e.phone = "Phone must be exactly 10 digits.";
    if (!form.date.trim()) e.date = "Date is required.";
    else if (!/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(form.date.trim())) e.date = "Use format: 25 Mar 2026";
    return e;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const agentObj = agents.find(a => a.name === form.agent) ?? null;
    const basePayload = {
      name: form.name.trim(), mobile: form.phone.trim(), source: form.source,
      campaign: form.campaign.trim() || null, status: form.status,
      date: new Date(form.date), remark: form.remark.trim() || "Manually added",
      ...(agentObj?.id ? { user: agentObj.id } : {}),
      ...(getRole() === "superadmin" && agentObj?.company ? { companyId: agentObj.company } : {}),
    };

    let payload = basePayload;
    const keyString = crm.getLocalKey();
    if (keyString) {
      try {
        const encryptedData = await crm.encrypt(
          { name: basePayload.name, mobile: basePayload.mobile, email: "", remark: basePayload.remark },
          keyString
        );
        payload = { ...basePayload, encryptedData };
      } catch { /* send plain */ }
    }

    const role = getRole();
    const endpoint =
      role === "superadmin" ? "/lead/superadmin/create" :
      role === "admin"      ? "/lead/admin/create" :
                              "/lead";
    try {
      const res = await api.post(endpoint, payload);
      const saved = res.data;
      onAdd({
        ...saved,
        id:             String(saved._id),
        name:           saved.name,
        mobile:         saved.mobile,
        phone:          saved.mobile,
        source:         saved.source   || "Web Form",
        campaign:       saved.campaign || "—",
        status:         saved.status,
        date:           new Date(saved.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        remark:         saved.remark,
        agent:          form.agent,
        company:        saved.company,
        callHistory:    saved.callHistory    || [],
        scheduledCalls: saved.scheduledCalls || [],
        previousAgents: saved.previousAgents || [],
        reassignCount:  saved.reassignCount  || 0,
        _raw_date:      saved.date,
        Quality:        saved.temperature ?? null,
        temperature:    saved.temperature ?? null,
        createdAt:      saved.createdAt,
        updatedAt:      saved.updatedAt,
      });
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to save lead. Please try again.";
      setErrors({ submit: msg });
    }
  };

  const textFields = [
    { label: "Lead Name *", key: "name",     placeholder: "Full name" },
    { label: "Phone *",     key: "phone",    placeholder: "10-digit number" },
    { label: "Campaign",    key: "campaign", placeholder: "Campaign name" },
    { label: "Remark",      key: "remark",   placeholder: "Notes" },
  ];
  const selectFields = [
    { label: "Source", key: "source", options: ALL_SOURCES },
    { label: "Agent",  key: "agent",  options: agents.map(a => a.name) },
    { label: "Status", key: "status", options: ALL_STATUSES },
  ];
  const inputCls = (key) =>
    `px-3 py-2 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none transition
    ${errors[key] ? "border-red-400 dark:border-red-500 focus:border-red-500" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add New Lead</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {textFields.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={form[f.key]} onChange={e => set(f.key, e.target.value)} className={inputCls(f.key)} />
              {errors[f.key] && (
                <span className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  {errors[f.key]}
                </span>
              )}
            </div>
          ))}
          {selectFields.map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <select value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Date *</label>
            <input type="text" value={form.date} onChange={e => set("date", e.target.value)} placeholder="25 Mar 2026" className={inputCls("date")} />
            {errors.date && (
              <span className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                {errors.date}
              </span>
            )}
          </div>
        </div>
        {errors.submit && <p className="text-[12px] text-red-500 mt-3 text-center">{errors.submit}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">Add Lead</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({ lead, agents, onClose, onSave }) {
  const [form, setForm] = useState({ ...lead });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Edit Lead</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Lead Name", key: "name" },
            { label: "Phone",     key: "phone" },
            { label: "Campaign",  key: "campaign" },
            { label: "Remark",    key: "remark" },
            { label: "Date",      key: "date" },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <input type="text" value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]" />
            </div>
          ))}
          {[
            { label: "Source", key: "source", options: ALL_SOURCES },
            { label: "Agent",  key: "agent",  options: agents.map(a => a.name) },
            { label: "Status", key: "status", options: ALL_STATUSES },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <select value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
          <button onClick={async () => {
            const role = getRole();
            const leadId = form.id;
            const endpoint =
              role === "superadmin" ? `/lead/superadmin/${leadId}` :
              role === "admin"      ? `/lead/admin/${leadId}` :
                                     `/lead/${leadId}`;
            try {
              const basePayload = {
                name:     form.name,
                mobile:   form.phone || form.mobile,
                source:   form.source,
                campaign: form.campaign === "—" ? "" : form.campaign,
                status:   form.status,
                remark:   form.remark,
              };
              let payload = basePayload;
              const keyString = crm.getLocalKey();
              if (keyString) {
                try {
                  const encryptedData = await crm.encrypt(
                    { name: basePayload.name, mobile: basePayload.mobile, email: form.email || "", remark: basePayload.remark },
                    keyString
                  );
                  payload = { ...basePayload, encryptedData };
                } catch { /* send plain */ }
              }
              await api.put(endpoint, payload);
              onSave({ ...lead, ...form });
              onClose();
            } catch (err) {
              alert("Failed to save: " + (err.response?.data?.message || err.message));
            }
          }} className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── Remarks History Panel ─────────────────────────────────────────────────────
function RemarksHistoryModal({ lead, onClose }) {
  const callHistory = Array.isArray(lead.callHistory) ? lead.callHistory : [];

  const sorted = [...callHistory].sort(
    (a, b) => new Date(b.calledAt) - new Date(a.calledAt)
  );

  const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE["New"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
              <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{lead.phone} · {lead.source}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Current remark + status */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{lead.status}</span>
          {lead.remark && (
            <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] italic truncate">"{lead.remark}"</span>
          )}
        </div>

        {/* Title row */}
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-[#7C3AED] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
          </svg>
          <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            Call History &amp; Remarks
          </span>
          <span className="ml-auto text-[11px] text-[#8B92A9] dark:text-[#565C75] bg-[#F1F4FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-full">
            {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* History list */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-2">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <svg className="w-8 h-8 text-[#C4C9D9] dark:text-[#3E4257]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
              </svg>
              <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No call history yet</p>
              <p className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257]">Remarks appear here after agent interactions</p>
            </div>
          ) : sorted.map((entry, i) => {
            const outcome = entry.outcome || "No Answer";
            const os = OUTCOME_STYLE[outcome] || OUTCOME_STYLE["No Answer"];
            const resolvedAudioUrl = audioUrl(entry.recordingUrl);
            return (
              <div key={i} className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[9px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                      {sorted.length - i}
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                        {entry.userName || "Agent"}
                      </p>
                      <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDateTime(entry.calledAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${os.bg} ${os.text}`}>{outcome}</span>
                    {entry.calledAt && (
                      <span className="text-[9px] text-[#8B92A9] bg-[#F0F2FA] dark:bg-[#1E2130] px-1.5 py-0.5 rounded-md">
                        {daysSince(entry.calledAt)}
                      </span>
                    )}
                  </div>
                </div>
                {entry.remark ? (
                  <div className="ml-8">
                    <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] italic leading-relaxed">
                      "{entry.remark}"
                    </p>
                  </div>
                ) : (
                  <p className="ml-8 text-[11px] text-[#C4C9D9] dark:text-[#3E4257] italic">No remark added</p>
                )}
                {/* FIX 2: preload="metadata" instead of "none"; FIX 3: onError hides broken player */}
                {resolvedAudioUrl && (
                  <div className="mt-2 ml-8">
                    <audio
                      controls
                      src={resolvedAudioUrl}
                      className="w-full h-7 rounded-lg accent-[#2563EB]"
                      preload="metadata"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recording & Remarks Modal ─────────────────────────────────────────────────
// Uses the same /call-logs/recordings endpoint as CallRecording.jsx,
// filtered client-side by the lead's phone number.
function RecordingModal({ lead, onClose }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    api.get("/call-logs/recordings?page=1&limit=200")
      .then(res => {
        const all = res.data.recordings || [];
        // Match by phone number — strip non-digits for safe comparison
        const phone = (lead.phone || lead.mobile || "").replace(/\D/g, "");
        const matched = phone
          ? all.filter(r => (r.phoneNumber || "").replace(/\D/g, "").endsWith(phone) ||
                            phone.endsWith((r.phoneNumber || "").replace(/\D/g, "")))
          : [];
        setRecordings(matched);
      })
      .catch(() => setError("Failed to fetch recordings."))
      .finally(() => setLoading(false));
  }, [lead]);

  const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE["New"];

  const fmtDur = (sec) => {
    if (!sec) return null;
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const callTypeColor = (type) => ({
    incoming: "#059669",
    outgoing: "#2563EB",
    missed:   "#EF4444",
    rejected: "#F59E0B",
    blocked:  "#64748B",
  }[type] || "#8B92A9");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] shrink-0">
              {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{lead.name}</p>
              <p className="text-[12px] text-[#8B92A9] mt-0.5">{lead.phone || lead.mobile}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Lead info grid */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: "Status", value: <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{lead.status}</span> },
            { label: "Source", value: lead.source },
            { label: "Agent",  value: lead.agent },
            { label: "Date",   value: lead.date },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-medium text-[#8B92A9] uppercase tracking-wide mb-1">{label}</p>
              <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{value}</div>
            </div>
          ))}
        </div>

        {/* ── Mobile Call Recordings (from /call-logs/recordings) ── */}
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
          <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            Call Recordings
          </span>
          {!loading && (
            <span className="ml-auto text-[11px] text-[#8B92A9] dark:text-[#565C75] bg-[#F1F4FF] dark:bg-[#1A2540] px-2 py-0.5 rounded-full">
              {recordings.length} {recordings.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 py-6 justify-center">
            <svg className="w-4 h-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-[13px] text-[#8B92A9]">Loading recordings...</span>
          </div>
        )}

        {!loading && error && (
          <p className="text-[12px] text-red-500 py-4 text-center">{error}</p>
        )}

        {!loading && !error && recordings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg className="w-8 h-8 text-[#C4C9D9] dark:text-[#3E4257]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
            <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75]">No recordings for this lead</p>
            <p className="text-[11px] text-[#C4C9D9] dark:text-[#3E4257]">Recordings upload automatically after calls on the mobile app</p>
          </div>
        )}

        {!loading && !error && recordings.length > 0 && (
          <div className="space-y-3">
            {recordings.map((rec, i) => (
              <div key={rec._id || i} className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-3 py-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                      {rec.user?.name || "Agent"}
                    </p>
                    <p className="text-[10px] text-[#8B92A9] mt-0.5">
                      {rec.timestamp ? new Date(rec.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      {rec.duration > 0 ? ` · ${fmtDur(rec.duration)}` : ""}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                    style={{ backgroundColor: callTypeColor(rec.callType) + "20", color: callTypeColor(rec.callType) }}>
                    {rec.callType || "call"}
                  </span>
                </div>
                {rec.remark && (
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] italic mb-2">"{rec.remark}"</p>
                )}
                {rec.recordingUrl
                  ? <audio
                      controls
                      src={audioUrl(rec.recordingUrl)}
                      className="w-full h-8 rounded-xl accent-[#2563EB]"
                      preload="metadata"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  : <p className="text-[11px] text-[#8B92A9] italic">Recording not available</p>
                }
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <button onClick={onClose} className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [leads, setLeads]     = useState([]);
  const [agents, setAgents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const role = getRole();

  useEffect(() => {
    fetchAll()
      .then(({ agents, leads }) => {
        setAgents(agents);
        setLeads(leads);
        nextId = leads.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatus]           = useState("All");
  const [agentFilter, setAgent]             = useState("All");
  const [sortBy, setSortBy]                 = useState("date");
  const [page, setPage]                     = useState(1);
  const [showAddModal, setAddModal]         = useState(false);
  const [editLead, setEditLead]             = useState(null);
  const [deleteConfirm, setDeleteConfirm]   = useState(null);
  const [recordingLead, setRecordingLead]   = useState(null);
  const [remarksLead, setRemarksLead]       = useState(null);
  const [timeFilter, setTimeFilter]         = useState("All");
  const PER_PAGE = 8;

  const isWithinRange = useDateFilter(timeFilter);
  const statuses   = ["All", ...ALL_STATUSES];
  const agentNames = ["All", ...agents.map(a => a.name)];

  const agentStats = useMemo(() => agents.map(agent => {
    const agentLeads = leads.filter(l => l.agent === agent.name);
    return { ...agent, leads: agentLeads.length, converted: agentLeads.filter(l => l.status === "Converted").length };
  }), [leads, agents]);

  const sourceStats = useMemo(() => ALL_SOURCES.map(src => ({
    label: src, count: leads.filter(l => l.source === src).length, color: SOURCE_COLORS[src],
  })).filter(s => s.count > 0), [leads]);

  const converted = leads.filter(l => l.status === "Converted").length;
  const convRate  = leads.length > 0 ? Math.round((converted / leads.length) * 100) : 0;
  const maxLeads  = Math.max(...agentStats.map(a => a.leads), 1);

  const filtered = useMemo(() => leads
    .filter(l => {
      if (!isWithinRange(l.date)) return false;
      const q = search.toLowerCase();
      return (
        (!q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.campaign?.toLowerCase().includes(q)) &&
        (statusFilter === "All" || l.status === statusFilter) &&
        (agentFilter  === "All" || l.agent  === agentFilter)
      );
    })
    .sort((a, b) => sortBy === "name" ? (a.name || "").localeCompare(b.name || "") : new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
  [leads, search, statusFilter, agentFilter, sortBy, isWithinRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged      = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const addLead  = lead    => { setLeads(ls => [lead, ...ls]); setPage(1); };
  const saveLead = updated => setLeads(ls => ls.map(l => l.id === updated.id ? { ...l, ...updated } : l));

  const deleteLead = async (id) => {
    const role = getRole();
    const endpoint =
      role === "superadmin" ? `/lead/superadmin/${id}` :
      role === "admin"      ? `/lead/admin/${id}` :
                              `/lead/${id}`;
    try {
      await api.delete(endpoint);
      setLeads(ls => ls.filter(l => l.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      alert("Failed to delete: " + (err.response?.data?.message || err.message));
    }
  };

  const displayDate = (dateStr) => {
    if (!dateStr) return "—";
    if (/^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const exportCSV = () => {
    const headers = ["#", "Name", "Phone", "Source", "Campaign", "Agent", "Status", "Date", "Remark", "Call Count"];
    const rows = filtered.map((l, i) =>
      [i + 1, l.name, l.phone, l.source, l.campaign, l.agent, l.status, l.date, l.remark, (l.callHistory || []).length]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "leads_export.csv" });
    a.click();
  };

  const importInputRef = useRef(null);

  const downloadCSVTemplate = () => {
    const headers = ["name", "mobile", "email", "source", "campaign", "status", "remark"];
    const example = ["John Doe", "9876543210", "john@example.com", "Website", "Summer Campaign", "New", "Interested in premium plan"];
    const blob = new Blob([[headers.join(","), example.join(",")].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "leads_import_template.csv" });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) { alert("❌ CSV must have a header row and at least one data row."); return; }

      const parseCSVLine = (line) => {
        const values = []; let current = "", inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
          else { current += ch; }
        }
        values.push(current.trim()); return values;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const leadsToImport = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });
        const nameVal   = row.name || row["full name"] || row["fullname"] || row["full_name"] || "";
        const mobileVal = row.mobile || row.phone || row["phone number"] || row["phone_number"] || row["mobile_number"] || row["number"] || "";
        const cleanMobile = mobileVal.replace(/\D/g, "");
        if (!cleanMobile) continue;
        leadsToImport.push({
          name: nameVal || "Unknown", mobile: cleanMobile, email: row.email || "",
          source: row.source || "CSV Import", campaign: row.campaign || "",
          status: row.status || "New", date: row.date || null,
          remark: row.remark || row.notes || "Imported via CSV",
        });
      }
      if (!leadsToImport.length) { alert("❌ No valid rows found. Check that your CSV has 'name' and 'mobile' columns."); return; }

      const { data } = await api.post("/lead/admin/import-csv", { leads: leadsToImport });
      alert(`✅ ${data.message}\nImported: ${data.savedCount}  |  Failed: ${data.errorCount}`);
      fetchAll().then(({ agents: a, leads: l }) => { setAgents(a); setLeads(l); }).catch(() => {});
    } catch (err) {
      alert("❌ Import failed: " + (err.response?.data?.message || err.message));
    }
  };

  const filterBtn = (current, setter, arr) =>
    arr.map(v => (
      <button key={v} onClick={() => { setter(v); setPage(1); }}
        className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition whitespace-nowrap
          ${v === current
            ? "bg-[#2563EB] text-white"
            : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"
          }`}>{v}</button>
    ));

  if (loading) return <Skeleton />;

  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC] dark:bg-[#0D0F14]">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-8 max-w-sm text-center">
        <div className="text-red-500 text-[14px] font-semibold mb-2">Failed to load data</div>
        <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-4">{fetchError}</p>
      </div>
    </div>
  );

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {showAddModal  && <AddLeadModal agents={agents} onClose={() => setAddModal(false)} onAdd={addLead} />}
      {editLead      && <EditLeadModal lead={editLead} agents={agents} onClose={() => setEditLead(null)} onSave={saveLead} />}
      {recordingLead && <RecordingModal lead={recordingLead} onClose={() => setRecordingLead(null)} />}
      {remarksLead   && <RemarksHistoryModal lead={remarksLead} onClose={() => setRemarksLead(null)} />}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Delete Lead?</h2>
            <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-5">
              This will permanently remove <strong className="text-[#0F1117] dark:text-[#F0F2FA]">{deleteConfirm.name}</strong> from the list.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
              <button onClick={() => deleteLead(deleteConfirm.id)} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Report Page</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{leads.length} total leads · {agents.length} agents</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#059669] text-white text-[13px] font-semibold hover:bg-emerald-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add Lead
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </button>
          {(role === "admin" || role === "superadmin") && (
            <>
              <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
              <div className="flex items-center rounded-xl overflow-hidden">
                <button onClick={() => importInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-violet-700 transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  Import CSV
                </button>
                <div className="w-px h-5 bg-violet-400/40" />
                <button onClick={downloadCSVTemplate} title="Download CSV template"
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#7C3AED] text-violet-200 text-[12px] font-semibold hover:bg-violet-700 transition whitespace-nowrap">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Template
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads"    value={leads.length} sub={`${leads.length} in pipeline`} accent="text-[#059669] dark:text-[#34D399]" />
        <StatCard label="Converted"      value={converted} sub={`${convRate}% conversion rate`} accent="text-[#059669] dark:text-[#34D399]" />
        <StatCard label="In Progress"    value={leads.filter(l => l.status === "In Progress").length} sub="Active pipeline" accent="text-[#D97706] dark:text-[#FCD34D]" />
        <StatCard label="Not Interested" value={leads.filter(l => l.status === "Not Interested").length} sub="Review needed" accent="text-[#DC2626] dark:text-[#F87171]" />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Agent performance</h2>
          <div className="space-y-4">
            {agentStats.sort((a, b) => b.leads - a.leads).map(a => (
              <div key={a.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: a.color }}>{a.avatar}</div>
                    <span className="text-[13px] font-medium text-[#0F1117] dark:text-[#F0F2FA]">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-[#8B92A9] dark:text-[#565C75]">
                    <span className="text-[#059669] dark:text-[#34D399] font-semibold">{a.converted} conv</span>
                    <span>{a.leads} leads</span>
                  </div>
                </div>
                <MiniBar value={a.leads} max={maxLeads} color={a.color} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">Leads by source</h2>
          <div className="space-y-3">
            {sourceStats.map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[13px] text-[#4B5168] dark:text-[#9DA3BB] flex-1">{s.label}</span>
                <div className="flex-1 h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(s.count / leads.length * 100)}%`, background: s.color }} />
                </div>
                <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] w-5 text-right">{s.count}</span>
                <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] w-8 text-right">{Math.round(s.count / leads.length * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <h3 className="text-[12px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3">Pipeline status</h3>
            <div className="grid grid-cols-2 gap-2">
              {ALL_STATUSES.map(s => {
                const count = leads.filter(l => l.status === s).length;
                const st = STATUS_STYLE[s] ?? STATUS_STYLE["New"];
                return (
                  <div key={s} className={`rounded-xl px-3 py-2.5 ${st.bg}`}>
                    <div className={`text-[18px] font-bold ${st.text}`}>{count}</div>
                    <div className={`text-[10px] font-medium ${st.text} opacity-80`}>{s}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Leads table ── */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              All leads
              <span className="ml-2 text-[12px] font-medium text-[#8B92A9] dark:text-[#565C75]">{filtered.length} results</span>
            </h2>
            <div className="flex items-center gap-2">
              <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                <option value="All">Time: All</option>
                <option value="Daily">Time: Daily</option>
                <option value="Weekly">Time: Weekly</option>
                <option value="Monthly">Time: Monthly</option>
                <option value="Quarterly">Time: Quarterly</option>
              </select>
              <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#4B5168] dark:text-[#9DA3BB] focus:outline-none">
                <option value="date">Sort: Latest</option>
                <option value="name">Sort: Name A–Z</option>
              </select>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-44" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">{filterBtn(statusFilter, setStatus, statuses)}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] self-center mr-1">Agent:</span>
            {filterBtn(agentFilter, setAgent, agentNames)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                {["#", "Lead Name", "Phone", "Source", "Campaign", "Agent", "Status", "Date", "Calls", "Remark", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads match your filters.</td></tr>
              ) : paged.map((lead, i) => {
                const st = STATUS_STYLE[lead.status] ?? STATUS_STYLE["New"];
                const callCount = (lead.callHistory || []).length;
                return (
                  <tr key={lead.id} className={`border-b border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A] transition ${i % 2 === 0 ? "" : "bg-[#FAFBFF] dark:bg-[#1E2130]"}`}>
                    <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75]">{(page - 1) * PER_PAGE + i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                          {(lead.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{lead.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.phone}</td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.source}</td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB]">{lead.campaign}</td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{lead.agent}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${st.bg} ${st.text}`}>{lead.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap">{displayDate(lead.date)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setRemarksLead(lead)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition
                          ${callCount > 0
                            ? "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] hover:bg-[#DBEAFE]"
                            : "bg-[#F8F9FC] dark:bg-[#13161E] text-[#8B92A9] dark:text-[#565C75] hover:bg-[#F1F4FF]"
                          }`}
                        title={callCount > 0 ? "View call history & remarks" : "No calls yet"}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        {callCount}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#4B5168] dark:text-[#9DA3BB] max-w-[140px] truncate">{lead.remark}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Edit */}
                        <button onClick={() => setEditLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#2563EB] hover:text-[#2563EB] text-[#8B92A9] transition" title="Edit">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        {/* Delete */}
                        <button onClick={() => setDeleteConfirm(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-red-400 hover:text-red-500 text-[#8B92A9] transition" title="Delete">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                        {/* Remarks history */}
                        <button onClick={() => setRemarksLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[#8B92A9] transition" title="Call History & Remarks">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/>
                          </svg>
                        </button>
                        {/* Recording */}
                        <button onClick={() => setRecordingLead(lead)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-[#0891B2] hover:text-[#0891B2] text-[#8B92A9] transition" title="Call Recording">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <span className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="h-8 w-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)}
                  className={`h-8 w-8 rounded-lg text-[12px] font-semibold transition ${n === page ? "bg-[#2563EB] text-white border border-[#2563EB]" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB]"}`}>{n}</button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="h-8 w-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-30 disabled:cursor-not-allowed transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
