import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig"; // ✅ ADDED

// ── Channel / status style maps ───────────────────────────────────────────────
const CHANNEL_STYLE = {
  SMS:      { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]" },
  WhatsApp: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]" },
  Email:    { bg: "bg-[#F5F3FF] dark:bg-[#1E1040]", text: "text-[#7C3AED] dark:text-[#A78BFA]" },
  Meta:     { bg: "bg-[#FFF0F3] dark:bg-[#2D0A14]", text: "text-[#E1306C] dark:text-[#F77FAD]" },
};

const STATUS_STYLE = {
  Active:    { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]", dot: "#059669" },
  Completed: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]", dot: "#2563EB" },
  Paused:    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]", dot: "#D97706" },
  Draft:     { bg: "bg-[#F1F5F9] dark:bg-[#1A1D27]", text: "text-[#8B92A9] dark:text-[#565C75]", dot: "#8B92A9" },
};

const LEAD_STATUS_STYLE = {
  "Converted":      { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]" },
  "In Progress":    { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]" },
  "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#DC2626] dark:text-[#F87171]" },
  "New":            { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]" },
};

// colour palette for Meta campaign cards (cycles if more than 6)
const META_COLORS = ["#E1306C","#2563EB","#7C3AED","#059669","#D97706","#0891B2"];

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n != null && n > 0 ? Number(n).toLocaleString() : "—");
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "20" }}>
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
      </div>
      <div className="text-[26px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{value}</div>
      <div className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mt-1">{label}</div>
      {sub && <div className="text-[11px] text-[#059669] dark:text-[#34D399] mt-1 font-medium">{sub}</div>}
    </div>
  );
}

// ── Lead drill-down drawer ────────────────────────────────────────────────────
function LeadDrawer({ campaign, onClose }) {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campaign) return;
    setLoading(true);
    if (campaign._isMeta) {
      // ✅ FIX 1: was fetch(`/api/leads?campaign=...`) — relative URL hit localhost:5173
      api.get(`/lead/by-campaign?campaign=${encodeURIComponent(campaign.name)}`)
        .then((res) => setLeads(Array.isArray(res.data) ? res.data : (res.data?.data || [])))
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    } else {
      setLeads(campaign.leads_list || []);
      setLoading(false);
    }
  }, [campaign]);

  if (!campaign) return null;
  const channel   = campaign.channel || "Meta";
  const ch        = CHANNEL_STYLE[channel] || CHANNEL_STYLE.Meta;
  const st        = STATUS_STYLE[campaign.status] || STATUS_STYLE.Active;
  const convRate  = campaign.leads > 0 ? Math.round((campaign.converted / campaign.leads) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ch.bg} ${ch.text}`}>{channel}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>{campaign.status}</span>
            </div>
            <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{campaign.name}</h2>
            <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
              Created {campaign._isMeta ? fmtDate(campaign.createdAt) : campaign.date}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[
            { label: "Sent",      value: fmt(campaign.sent) },
            { label: "Leads",     value: fmt(campaign.leads) },
            { label: "Conv. rate",value: convRate + "%" },
          ].map((s) => (
            <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-3 text-center">
              <div className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{s.value}</div>
              <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Leads list */}
        <div className="px-6 py-4">
          <h3 className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3">
            Leads from this campaign
            <span className="ml-2 text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75]">{leads.length} shown</span>
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8B92A9] gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              Loading leads…
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-10 text-[13px] text-[#8B92A9] dark:text-[#565C75]">No leads yet.</div>
          ) : (
            <div className="space-y-2">
              {leads.map((l, i) => {
                const name   = l.name   || "Unknown";
                const phone  = l.phone  || l.mobile || "—";
                const agent  = l.agent  || (l.user && (l.user.name || "Assigned")) || "Unassigned";
                const status = l.status || "New";
                const remark = l.remark || "—";
                const ls     = LEAD_STATUS_STYLE[status] || LEAD_STATUS_STYLE["New"];
                return (
                  <div key={i} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 border border-[#E4E7EF] dark:border-[#262A38]">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                          {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{name}</div>
                          <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{phone}</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${ls.bg} ${ls.text}`}>{status}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8B92A9] dark:text-[#565C75]">
                        Assigned: <span className="text-[#4B5168] dark:text-[#9DA3BB] font-medium">{agent}</span>
                      </span>
                      <span className="text-[#8B92A9] dark:text-[#565C75] italic">{remark}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Connect Meta Campaign modal ───────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const empty = {
    campaignName:    "",
    pageId:          "",
    pageAccessToken: "",
    appSecret:       "",
    verifyToken:     "",
    graphApiVersion: "v25.0",
    formIds:         "",
    defaultStatus:   "New",
    defaultRemark:   "Lead from Meta Campaign",
  };

  const [form, setForm]             = useState(empty);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState(false);
  const [showToken, setShowToken]   = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const required = ["campaignName", "pageId", "pageAccessToken", "appSecret", "verifyToken"];
  const isValid  = required.every((k) => form[k].trim() !== "");

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      // ✅ FIX 2: was fetch("/api/meta-config", { method: "POST", ... }) — relative URL
      const res = await api.post("/meta-config", {
        campaignName:    form.campaignName.trim(),
        pageId:          form.pageId.trim(),
        pageAccessToken: form.pageAccessToken.trim(),
        formIds:         form.formIds ? form.formIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
        defaultStatus:   form.defaultStatus || "New",
        defaultRemark:   form.defaultRemark || "Lead from Meta Campaign",
        graphApiVersion: form.graphApiVersion.trim() || "v25.0",
        _meta: {
          META_APP_SECRET:        form.appSecret.trim(),
          META_VERIFY_TOKEN:      form.verifyToken.trim(),
          META_GRAPH_API_VERSION: form.graphApiVersion.trim(),
        },
      });
      setSuccess(true);
      onCreated && onCreated(res.data.data);
    } catch (err) {
      // axios puts error response in err.response.data
      setError(err.response?.data?.message || err.message || "Failed to connect campaign");
    } finally {
      setLoading(false);
    }
  };

  // ── Success ─────────────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Campaign connected!</h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            Meta leads from <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{form.campaignName}</span> will now flow into your CRM automatically via round-robin assignment.
          </p>
          <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3 text-left text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5 space-y-1 border border-[#E4E7EF] dark:border-[#262A38]">
            <p className="font-semibold text-[#4B5168] dark:text-[#9DA3BB] text-[12px] mb-2">📋 Add these to your server <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded">.env</code></p>
            <p><span className="text-[#2563EB]">META_APP_SECRET</span>={form.appSecret}</p>
            <p><span className="text-[#2563EB]">META_VERIFY_TOKEN</span>={form.verifyToken}</p>
            <p><span className="text-[#2563EB]">META_GRAPH_API_VERSION</span>={form.graphApiVersion}</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">Done</button>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  const EyeOn  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
  const EyeOff = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Connect Meta Campaign</h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Auto-import leads · Round-robin assigned to your team</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">

          {/* Campaign Info */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Campaign Info</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Campaign Name <span className="text-[#DC2626]">*</span></label>
                <input type="text" value={form.campaignName} onChange={set("campaignName")} placeholder="e.g. Summer Sale 2025" className={FIELD_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Status</label>
                  <select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}>
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Remark</label>
                  <input type="text" value={form.defaultRemark} onChange={set("defaultRemark")} placeholder="Lead from Meta Campaign" className={FIELD_CLS} />
                </div>
              </div>
            </div>
          </div>

          {/* Meta Config */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Meta / Facebook Config</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Page ID <span className="text-[#DC2626]">*</span></label>
                <input type="text" value={form.pageId} onChange={set("pageId")} placeholder="e.g. 123456789012345" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Found in Facebook Page settings → About</p>
              </div>

              {/* Page Access Token */}
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Page Access Token <span className="text-[#DC2626]">*</span></label>
                <div className="relative">
                  <input type={showToken ? "text" : "password"} value={form.pageAccessToken} onChange={set("pageAccessToken")} placeholder="EAAxxxxxx…" className={FIELD_CLS + " pr-10"} />
                  <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">
                    {showToken ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1">Generate a never-expiring token in Meta Business Suite → System Users</p>
              </div>

              {/* App Secret */}
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  App Secret <span className="text-[#DC2626]">*</span>
                  <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">(META_APP_SECRET)</span>
                </label>
                <div className="relative">
                  <input type={showSecret ? "text" : "password"} value={form.appSecret} onChange={set("appSecret")} placeholder="Your Meta app secret" className={FIELD_CLS + " pr-10"} />
                  <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">
                    {showSecret ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Verify Token <span className="text-[#DC2626]">*</span>
                    <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">(META_VERIFY_TOKEN)</span>
                  </label>
                  <input type="text" value={form.verifyToken} onChange={set("verifyToken")} placeholder="skyup_meta_2025" className={FIELD_CLS} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Graph API Version
                    <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">(META_GRAPH_API_VERSION)</span>
                  </label>
                  <input type="text" value={form.graphApiVersion} onChange={set("graphApiVersion")} placeholder="v25.0" className={FIELD_CLS} />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Form IDs <span className="text-[10px] font-normal text-[#8B92A9]">(optional — blank = accept all)</span>
                </label>
                <input type="text" value={form.formIds} onChange={set("formIds")} placeholder="form_id_1, form_id_2" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Comma-separated. Find in Meta Ads Manager → Lead forms</p>
              </div>
            </div>
          </div>

          {/* Round-robin info banner */}
          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
            <div className="shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">Round-robin auto-assignment</p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                Every new lead from this campaign will be automatically assigned to the next available team member in rotation — no manual assignment needed.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!isValid || loading} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Connecting…</>
              : "Connect & Start Receiving Leads"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const [campaigns, setCampaigns]     = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [selected, setSelected]       = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [filter, setFilter]           = useState("All");
  const [search, setSearch]           = useState("");

  // ── Fetch Meta configs from backend ─────────────────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    setPageLoading(true);
    try {
      // ✅ FIX 3: was fetch("/api/meta-config") — relative URL hit localhost:5173
      const res  = await api.get("/meta-config");
      const data = res.data;
      const list = Array.isArray(data) ? data : (data.data || []);

      const shaped = list.map((cfg, idx) => ({
        _id:       cfg._id,
        _isMeta:   true,
        id:        cfg._id,
        name:      cfg.campaignName,
        channel:   "Meta",
        status:    cfg.isActive ? "Active" : "Paused",
        sent:      cfg.sent      ?? 0,
        leads:     cfg.leads     ?? 0,
        converted: cfg.converted ?? 0,
        cost:      cfg.cost      ?? 0,
        date:      fmtDate(cfg.createdAt),
        createdAt: cfg.createdAt,
        color:     META_COLORS[idx % META_COLORS.length],
        pageId:    cfg.pageId,
        company:   cfg.company,
        isActive:  cfg.isActive,
      }));

      setCampaigns(shaped);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setCampaigns([]);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // ── Toggle active / pause ────────────────────────────────────────────────────
  const handleToggle = async (e, campaign) => {
    e.stopPropagation();
    try {
      // ✅ FIX 4: was fetch(`/api/meta-config/${id}/toggle`, { method: "PATCH" })
      await api.patch(`/meta-config/${campaign._id}/toggle`);
      fetchCampaigns();
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  // ── Delete / disconnect ──────────────────────────────────────────────────────
  const handleDelete = async (e, campaign) => {
    e.stopPropagation();
    if (!window.confirm(`Disconnect "${campaign.name}"? This cannot be undone.`)) return;
    try {
      // ✅ FIX 5: was fetch(`/api/meta-config/${id}`, { method: "DELETE" })
      await api.delete(`/meta-config/${campaign._id}`);
      fetchCampaigns();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const filters = ["All", "Active", "Paused"];

  const filtered = campaigns.filter((c) => {
    const matchFilter = filter === "All" || c.status === filter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalLeads     = campaigns.reduce((s, c) => s + (c.leads || 0), 0);
  const totalConverted = campaigns.reduce((s, c) => s + (c.converted || 0), 0);
  const totalSent      = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const overallCPL     = totalLeads > 0 ? Math.round(campaigns.reduce((s, c) => s + (c.cost || 0), 0) / totalLeads) : 0;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Campaigns</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            {pageLoading ? "Loading…" : `${campaigns.length} Meta campaign${campaigns.length !== 1 ? "s" : ""} connected`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Connect Meta Campaign
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total sent"      value={totalSent.toLocaleString()}      color="#2563EB" sub="Across all campaigns" />
        <SummaryCard label="Leads generated" value={totalLeads.toLocaleString()}     color="#7C3AED" sub="From all campaigns" />
        <SummaryCard label="Conversions"     value={totalConverted.toLocaleString()} color="#059669" sub={totalLeads > 0 ? `${Math.round(totalConverted / totalLeads * 100)}% conv. rate` : ""} />
        <SummaryCard label="Avg. cost/lead"  value={`₹${overallCPL}`}               color="#D97706" sub="Across all spend" />
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${
                filter === f
                  ? "bg-[#2563EB] text-white"
                  : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"
              }`}
            >{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchCampaigns} className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] transition" title="Refresh">
            <svg className={`w-3.5 h-3.5 ${pageLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/></svg>
            <input
              type="text"
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-4 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] w-48"
            />
          </div>
        </div>
      </div>

      {/* Campaign cards */}
      {pageLoading ? (
        <div className="flex items-center justify-center py-24 text-[#8B92A9] gap-3">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
          <span className="text-[14px]">Loading campaigns…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const st       = STATUS_STYLE[c.status] || STATUS_STYLE.Active;
            const convRate = c.leads > 0 ? Math.round((c.converted / c.leads) * 100) : 0;
            const cpl      = c.leads > 0 ? Math.round(c.cost / c.leads) : 0;

            return (
              <div key={c._id} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-shadow">
                <div className="h-1 w-full" style={{ background: c.color }} />

                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CHANNEL_STYLE.Meta.bg} ${CHANNEL_STYLE.Meta.text}`}>Meta</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${st.bg} ${st.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.dot }} />
                          {c.status}
                        </span>
                      </div>
                      <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-snug truncate">{c.name}</h3>
                      <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{c.date}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Sent",  value: fmt(c.sent) },
                      { label: "Leads", value: fmt(c.leads) },
                      { label: "Conv.", value: c.converted > 0 ? c.converted : "—" },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center">
                        <div className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{s.value}</div>
                        <div className="text-[9px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Conv rate bar */}
                  {c.leads > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">Conv. rate</span>
                        <span className="text-[11px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{convRate}%</span>
                      </div>
                      <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${convRate}%`, background: c.color }} />
                      </div>
                      {c.cost > 0 && (
                        <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-1">
                          ₹{cpl} cost per lead · ₹{c.cost.toLocaleString()} total spend
                        </p>
                      )}
                    </div>
                  )}

                  {/* Round robin badge */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <svg className="w-3 h-3 text-[#2563EB] dark:text-[#4F8EF7] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">Round-robin auto-assignment · Page ID: <span className="font-mono">{c.pageId}</span></span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
                    <button
                      onClick={() => setSelected(c)}
                      className="flex-1 py-2 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-semibold hover:bg-[#dce7ff] dark:hover:bg-[#1e2d52] transition"
                    >
                      View leads ({c.leads})
                    </button>
                    <button
                      onClick={(e) => handleToggle(e, c)}
                      className={`px-3 py-2 rounded-xl border text-[12px] font-semibold transition ${
                        c.isActive
                          ? "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:border-[#D97706] hover:text-[#D97706]"
                          : "border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:border-[#059669] hover:text-[#059669]"
                      }`}
                    >
                      {c.isActive ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, c)}
                      className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:border-[#DC2626] hover:text-[#DC2626] transition"
                      title="Disconnect"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && !pageLoading && (
            <div className="col-span-3 text-center py-20 text-[#8B92A9] dark:text-[#565C75]">
              <div className="text-[40px] mb-3">📡</div>
              <p className="text-[15px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">No Meta campaigns connected</p>
              <p className="text-[13px] mt-1">Click "Connect Meta Campaign" to start receiving leads automatically.</p>
            </div>
          )}
        </div>
      )}

      {/* Drawers / modals */}
      {selected   && <LeadDrawer  campaign={selected}  onClose={() => setSelected(null)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchCampaigns} />}
    </div>
  );
}