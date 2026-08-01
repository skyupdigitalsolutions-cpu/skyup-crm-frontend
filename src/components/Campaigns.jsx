import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, X, Check, BarChart3, RefreshCw, Globe, Info, AlertCircle,
  Lock, ChevronRight, ChevronLeft, Mail, Eye as EyeIcon, EyeOff as EyeOffIcon, Plus, UploadCloud,
  Search, Users, User, Send, Pencil as PencilIcon,
  Flame, Thermometer, Snowflake, ClipboardList, Inbox, Radio, CheckCircle2, AlertTriangle,
} from "lucide-react";
import api from "../data/axiosConfig";
import VoiceBotPanel from "./VoiceBotPanel";
import GoogleAnalyticsConnect from "./GoogleAnalyticsConnect";
import { io as socketIO } from "socket.io-client";
import usePlanFeatures from "../hooks/usePlanFeatures";

// ── Channel / status style maps ───────────────────────────────────────────────
const CHANNEL_STYLE = {
  SMS: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]" },
  WhatsApp: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]" },
  Email: { bg: "bg-[#F5F3FF] dark:bg-[#1E1040]", text: "text-[#7C3AED] dark:text-[#A78BFA]" },
  Meta: { bg: "bg-[#FFF0F3] dark:bg-[#2D0A14]", text: "text-[#E1306C] dark:text-[#F77FAD]" },
  Google: { bg: "bg-[#FFF8F0] dark:bg-[#2D1A00]", text: "text-[#EA4335] dark:text-[#FF6B5B]" },
  Website: { bg: "bg-[#F0FDF4] dark:bg-[#052E1C]", text: "text-[#16A34A] dark:text-[#4ADE80]" },
};

const STATUS_STYLE = {
  Active: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]", dot: "#059669" },
  Completed: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]", dot: "#2563EB" },
  Paused: { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]", dot: "#D97706" },
  Draft: { bg: "bg-[#F1F5F9] dark:bg-[#1A1D27]", text: "text-[#8B92A9] dark:text-[#565C75]", dot: "#8B92A9" },
};

const LEAD_STATUS_STYLE = {
  Converted: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]" },
  "In Progress": { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]" },
  "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#DC2626] dark:text-[#F87171]" },
  New: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]" },
};

const LEAD_TEMP_STYLE = {
  Hot: { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#DC2626] dark:text-[#F87171]", icon: "" },
  Warm: { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]", icon: "" },
  Cold: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]", icon: "" },
};

const META_COLORS = ["#E1306C", "#2563EB", "#7C3AED", "#059669", "#D97706", "#0891B2"];
const GOOGLE_COLORS = ["#EA4335", "#FBBC05", "#34A853", "#4285F4", "#FF6D00", "#46BDC6"];
const WEBSITE_COLORS = ["#16A34A", "#0891B2", "#7C3AED", "#D97706", "#059669", "#2563EB"];

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

function maskPhone(phone) {
  if (!phone) return "—";
  const str = String(phone).replace(/\s/g, "");
  if (str.length <= 4) return "••••";
  return str.slice(0, 2) + "•".repeat(Math.max(str.length - 4, 3)) + str.slice(-2);
}

function maskEmail(email) {
  if (!email) return null;
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return "•".repeat(8);
  const local  = email.slice(0, atIdx);
  const domain = email.slice(atIdx + 1);
  let maskedLocal;
  if (local.length <= 2) {
    maskedLocal = "•".repeat(local.length);
  } else {
    const mid = Math.max(1, local.length - 4);
    maskedLocal = local.slice(0, 2) + "•".repeat(mid) + local.slice(-2);
  }
  const dotIdx = domain.lastIndexOf(".");
  const maskedDomain = dotIdx > 0
    ? "•".repeat(dotIdx) + domain.slice(dotIdx)
    : "•".repeat(domain.length);
  return `${maskedLocal}@${maskedDomain}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n != null && n > 0 ? Number(n).toLocaleString() : "—");
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ── Eye icons ─────────────────────────────────────────────────────────────────
const EyeOn = () => (
  <EyeIcon className="w-4 h-4" />
);
const EyeOff = () => (
  <EyeOffIcon className="w-4 h-4" />
);

// ── Edit icon ─────────────────────────────────────────────────────────────────
const EditIcon = () => (
  <PencilIcon className="w-3.5 h-3.5" />
);

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

// ── Sync Meta Modal ───────────────────────────────────────────────────────────
function SyncMetaModal({ onClose, onSynced, prefillPageId, parentName = "" }) {
  const [form, setForm] = useState({
    pageId: prefillPageId || "",
    pageAccessToken: "",
    graphApiVersion: "v25.0",
    parentCampaignName: parentName || "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSync = async () => {
    if (!form.pageId.trim() || !form.pageAccessToken.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await api.post("/meta-config/sync", {
        pageId: form.pageId.trim(),
        pageAccessToken: form.pageAccessToken.trim(),
        graphApiVersion: form.graphApiVersion.trim() || "v25.0",
        parentCampaignName: form.parentCampaignName.trim() || undefined,
      });
      setResult(res.data);
      onSynced && onSynced();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Sync failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
          Auto-Sync Campaigns from Meta
        </h2>
        <p className="text-[11px] text-[#8B92A9] mb-5">
          Fetches all lead forms on your page and auto-creates a config for each campaign &amp; ad set.
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Campaign Group <span className="text-[#DC2626]">*</span>
              <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">— the main campaign these ad sets belong to</span>
            </label>
            <input
              value={form.parentCampaignName}
              onChange={set("parentCampaignName")}
              placeholder="e.g. Skyup Ads"
              className={FIELD_CLS}
            />
            <p className="text-[10px] text-[#8B92A9] mt-1">
              All synced ad sets will be grouped under this campaign on the Campaigns page.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Page ID <span className="text-[#DC2626]">*</span>
            </label>
            <input value={form.pageId} onChange={set("pageId")} placeholder="e.g. 123456789012345" className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Page Access Token <span className="text-[#DC2626]">*</span>
            </label>
            <input type="password" value={form.pageAccessToken} onChange={set("pageAccessToken")} placeholder="EAAxxxxxx…" className={FIELD_CLS} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Graph API Version
            </label>
            <input value={form.graphApiVersion} onChange={set("graphApiVersion")} placeholder="v25.0" className={FIELD_CLS} />
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] rounded-xl px-4 py-3 text-[12px] text-[#DC2626]">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#A7F3D0] rounded-xl px-4 py-3 text-[12px] text-[#059669]">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> {result.created} ad sets created, {result.skipped} already existed.</span>
            <ul className="mt-2 space-y-1">
              {result.forms.map((f, i) => (
                <li key={i} className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
                  <span className="font-semibold">{f.campaignName}</span>
                  {f.adSetName && <span> › {f.adSetName}</span>}
                  <span className="ml-1 text-[#8B92A9]">({f.status})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && result.statusSync && (
          result.statusSync.credentialed ? (
            <div className="mb-4 bg-[#EEF3FF] dark:bg-[#0E1A33] border border-[#BFD4FF] dark:border-[#1E355F] rounded-xl px-4 py-3 text-[12px] text-[#2563EB] dark:text-[#93B4FF]">
              Status sync: paused {result.statusSync.paused || 0}, reactivated {result.statusSync.reactivated || 0} (checked {result.statusSync.checked || 0} campaigns against Meta).
            </div>
          ) : (
            <div className="mb-4 bg-[#FFFBEB] dark:bg-[#2D1F00] border border-[#FCD34D]/40 rounded-xl px-4 py-3 text-[12px] text-[#92400E] dark:text-[#FCD34D]">
              <span className="font-semibold">Auto-pause not active.</span> To mirror paused/archived ad sets from Meta, add an <span className="font-semibold">Ad Account ID</span> + an <code className="bg-black/5 dark:bg-white/10 px-1 rounded">ads_read</code> token to a Meta campaign (Edit → Ad Performance). The page token alone can’t read ad-set status.
            </div>
          )
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F8F9FC] transition">
            Close
          </button>
          <button
            onClick={handleSync}
            disabled={!form.pageId.trim() || !form.pageAccessToken.trim() || !form.parentCampaignName.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? "Syncing…" : "Sync All Campaigns & Ad Sets"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lead drill-down drawer ────────────────────────────────────────────────────
function LeadDrawer({ campaign, onClose }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tempFilter, setTempFilter] = useState("All");

  const fetchLeads = () => {
    if (!campaign) return;
    setLoading(true);
    if (campaign._isMeta || campaign._isGoogle || campaign._isWebsite) {
      // When this is a Meta ad set (has adSetName), scope the query to that
      // specific ad set so only its leads are shown, not all campaign leads.
      // Prefer the exact metaConfigId so sibling ad sets sharing a campaign
      // name can't bleed into each other.
      const adSetParam =
        campaign._isMeta && campaign.adSetName
          ? `&adSetName=${encodeURIComponent(campaign.adSetName)}`
          : "";
      const cfgParam =
        campaign._isMeta && campaign._id
          ? `&metaConfigId=${encodeURIComponent(campaign._id)}`
          : "";
      api.get(`/lead/by-campaign?campaign=${encodeURIComponent(campaign.name)}${adSetParam}${cfgParam}`)
        .then((res) => setLeads(Array.isArray(res.data) ? res.data : res.data?.data || []))
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    } else {
      setLeads(campaign.leads_list || []);
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [campaign]);

  if (!campaign) return null;

  const isMetaAdSet = campaign._isMeta && !!campaign.adSetName;

  // Filter leads by temperature when this is a Meta ad set
  const filteredLeads = isMetaAdSet && tempFilter !== "All"
    ? leads.filter((l) => l.temperature === tempFilter || l.leadCategory === tempFilter)
    : leads;

  const normalizedLeads = filteredLeads.map((l) => ({ ...l, id: l._id || l.id, phone: l.mobile || l.phone }));
  const channel = campaign.channel || "Meta";
  const ch = CHANNEL_STYLE[channel] || CHANNEL_STYLE.Meta;
  const st = STATUS_STYLE[campaign.status] || STATUS_STYLE.Active;

  // Counts for filter pills
  const hotCount  = leads.filter((l) => l.temperature === "Hot"  || l.leadCategory === "Hot").length;
  const warmCount = leads.filter((l) => l.temperature === "Warm" || l.leadCategory === "Warm").length;
  const coldCount = leads.filter((l) => l.temperature === "Cold" || l.leadCategory === "Cold").length;

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
            {campaign.adSetName && (
              <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400">
                Ad Set: {campaign.adSetName}
              </span>
            )}
            {campaign.parentCampaignName && (
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Parent: {campaign.parentCampaignName}
              </p>
            )}
            <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
              Created {campaign._isMeta || campaign._isGoogle || campaign._isWebsite ? fmtDate(campaign.createdAt) : campaign.date}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[{ label: "Leads", value: fmt(campaign.leads) }].map((s) => (
            <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-3 text-center">
              <div className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{s.value}</div>
              <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Temperature filter pills — only for Meta ad sets */}
        {isMetaAdSet && (
          <div className="px-6 pt-4 pb-0">
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "All",  label: `All (${leads.length})`,  color: "text-[#4B5168] dark:text-[#9DA3BB]", activeBg: "bg-[#EEF3FF] dark:bg-[#1A2540]", activeText: "text-[#2563EB]" },
                { key: "Hot",  label: `Hot (${hotCount})`,   Icon: Flame,      color: "text-[#DC2626]", activeBg: "bg-[#FEF2F2]", activeText: "text-[#DC2626]" },
                { key: "Warm", label: `Warm (${warmCount})`, Icon: Thermometer, color: "text-[#D97706]", activeBg: "bg-[#FFFBEB]", activeText: "text-[#D97706]" },
                { key: "Cold", label: `Cold (${coldCount})`, Icon: Snowflake,  color: "text-[#2563EB]", activeBg: "bg-[#EEF3FF]", activeText: "text-[#2563EB]" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTempFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                    tempFilter === f.key
                      ? `${f.activeBg} ${f.activeText} border-current`
                      : "bg-white dark:bg-[#1A1D27] border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:border-[#CBD5E1]"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">{f.Icon && <f.Icon className="w-3 h-3" />}{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leads list */}
        <div className="px-6 py-4">
          <h3 className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3">
            Leads from this campaign
            <span className="ml-2 text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75]">{filteredLeads.length} shown</span>
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8B92A9] gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading leads…
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-10 text-[13px] text-[#8B92A9] dark:text-[#565C75]">
              {tempFilter !== "All" ? `No ${tempFilter} leads yet.` : "No leads yet."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLeads.map((l, i) => {
                const name   = l.name || "Unknown";
                const phone  = l.phone || l.mobile || "—";
                const agent  = l.agent || (l.user && (l.user.name || "Assigned")) || "Unassigned";
                const status = l.status || "New";
                const remark = l.remark || "—";
                const temp   = l.temperature || l.leadCategory || null;
                const ls     = LEAD_STATUS_STYLE[status] || LEAD_STATUS_STYLE["New"];
                const lt     = temp ? LEAD_TEMP_STYLE[temp] || null : null;
                return (
                  <div key={i} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 border border-[#E4E7EF] dark:border-[#262A38]">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                          {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{name}</div>
                          <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 font-mono">{maskPhone(phone)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lt && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lt.bg} ${lt.text}`}>{lt.icon} {temp}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${ls.bg} ${ls.text}`}>{status}</span>
                      </div>
                    </div>
                    {/* Qualification scoring — Meta ad-set leads that have been scored */}
                    {l.leadScore != null && (
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mb-1.5">
                        <span className="text-[10px] text-[#8B92A9]">
                          Score:{" "}
                          <span className="text-[11px] font-bold" style={{ color: temp === "Hot" ? "#DC2626" : temp === "Warm" ? "#D97706" : "#2563EB" }}>
                            {l.leadScore}
                          </span>
                          {l.maxScore != null && (
                            <span className="text-[10px] text-[#8B92A9] font-medium"> / {l.maxScore}</span>
                          )}
                        </span>
                        {(l.qualificationPercentage != null || l.maxScore) && (
                          <span className="text-[10px] text-[#8B92A9]">
                            (
                            <span className="text-[11px] font-bold" style={{ color: temp === "Hot" ? "#DC2626" : temp === "Warm" ? "#D97706" : "#2563EB" }}>
                              {l.qualificationPercentage != null
                                ? l.qualificationPercentage
                                : l.maxScore
                                ? Math.round((l.leadScore / l.maxScore) * 100)
                                : 0}
                              %
                            </span>
                            )
                          </span>
                        )}
                        {(l.leadCategory || temp) && (
                          <span className="text-[10px] font-semibold" style={{ color: (l.leadCategory || temp) === "Hot" ? "#DC2626" : (l.leadCategory || temp) === "Warm" ? "#D97706" : "#2563EB" }}>
                            {l.leadCategory || temp} Lead
                          </span>
                        )}
                      </div>
                    )}
                    {maskEmail(l.email) && (
                      <div className="flex items-center gap-1 mt-1 mb-1">
                        <Mail className="w-3 h-3 text-[#059669] dark:text-[#34D399] shrink-0" />
                        <span className="text-[11px] text-[#059669] dark:text-[#34D399] font-mono truncate">{maskEmail(l.email)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8B92A9] dark:text-[#565C75]">Assigned: <span className="text-[#4B5168] dark:text-[#9DA3BB] font-medium">{agent}</span></span>
                      <span className="text-[#8B92A9] dark:text-[#565C75] italic">{remark}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Voice Bot panel — hidden from UI */}
        {false && (
          <div className="px-6 pb-6">
            <VoiceBotPanel leads={normalizedLeads} campaignName={campaign.name} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Connect Meta Campaign modal ───────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const empty = {
    campaignName: "", pageId: "", pageAccessToken: "", appSecret: "", verifyToken: "",
    graphApiVersion: "v25.0", formIds: "", formId: "", defaultStatus: "New",
    adSetName: "", parentCampaignName: "", category: "",
    // Ad performance (Insights API) — optional
    adAccountId: "", adsToken: "",
    // Conversions API send-back — optional
    pixelId: "", capiAccessToken: "",
  };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const required = ["campaignName", "pageId", "pageAccessToken", "appSecret", "verifyToken"];
  const isValid = required.every((k) => form[k].trim() !== "");

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true); setError("");
    try {
      const res = await api.post("/meta-config", {
        campaignName: form.campaignName.trim(), pageId: form.pageId.trim(),
        pageAccessToken: form.pageAccessToken.trim(),
        formIds: form.formIds ? form.formIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
        formId: form.formId.trim() || "",
        defaultStatus: form.defaultStatus || "New",
        graphApiVersion: form.graphApiVersion.trim() || "v25.0",
        adSetName: form.adSetName.trim() || undefined,
        parentCampaignName: form.parentCampaignName.trim() || undefined,
        category: form.category ? form.category.trim() : undefined,
        // Ad performance (Insights API) credentials — optional.
        adAccountId: form.adAccountId.trim() || "",
        adsToken: form.adsToken.trim() || "",
        // Conversions API send-back credentials — optional.
        pixelId: form.pixelId.trim() || "",
        capiAccessToken: form.capiAccessToken.trim() || "",
        _meta: {
          META_APP_SECRET: form.appSecret.trim(),
          META_VERIFY_TOKEN: form.verifyToken.trim(),
          META_GRAPH_API_VERSION: form.graphApiVersion.trim(),
        },
      });
      setSuccess(true); onCreated && onCreated(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to connect campaign");
    } finally { setLoading(false); }
  };

  if (success) {
    // ISO/IEC 27001 A.8.24 — never echo secrets to the DOM/UI. Show only a
    // masked confirmation; the admin already typed these in this session, so
    // re-displaying the raw string in plain text adds no legitimate value and
    // creates an XSS/shoulder-surf/screenshot exposure surface. Full values
    // still reach the backend via the API payload sent above — this only
    // changes what's rendered here.
    const mask = (v) => (v ? `••••••••${String(v).slice(-4)}` : "—");
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-[#059669]" />
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Campaign connected!</h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            Meta leads from <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{form.campaignName}</span> will now flow into your CRM automatically.
          </p>
          <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3 text-left text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5 space-y-1 border border-[#E4E7EF] dark:border-[#262A38]">
            <p className="font-semibold text-[#4B5168] dark:text-[#9DA3BB] text-[12px] mb-2">Credentials received — stored server-side only</p>
            <p><span className="text-[#2563EB]">META_APP_SECRET</span>={mask(form.appSecret)}</p>
            <p><span className="text-[#2563EB]">META_VERIFY_TOKEN</span>={mask(form.verifyToken)}</p>
            <p><span className="text-[#2563EB]">META_GRAPH_API_VERSION</span>={form.graphApiVersion || "default"}</p>
            <p className="text-[10px] pt-1 text-[#8B92A9] dark:text-[#565C75]">These are saved on the server and won't be shown again in full. To rotate them, use "Reconnect" from the campaign menu.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Connect Meta Campaign</h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Auto-import leads · Round-robin assigned to your team</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
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
                  <select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}><option>New</option><option>In Progress</option></select>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Ad Set Name <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span>
                </label>
                <input type="text" value={form.adSetName || ""} onChange={set("adSetName")} placeholder="e.g. Retargeting - Mumbai" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Differentiates multiple ad sets within the same campaign</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Parent Campaign <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span>
                </label>
                <input type="text" value={form.parentCampaignName || ""} onChange={set("parentCampaignName")} placeholder="e.g. Summer Sale 2025" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Groups related ad sets together on this page</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Category <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span>
                </label>
                <input type="text" value={form.category || ""} onChange={set("category")} placeholder="e.g. Real Estate, Education, Healthcare" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Groups campaigns by category in the Performance Marketing Dashboard</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Meta / Facebook Config</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Page ID <span className="text-[#DC2626]">*</span></label>
                <input type="text" value={form.pageId} onChange={set("pageId")} placeholder="e.g. 123456789012345" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Found in Facebook Page settings → About</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Page Access Token <span className="text-[#DC2626]">*</span></label>
                <div className="relative">
                  <input type={showToken ? "text" : "password"} value={form.pageAccessToken} onChange={set("pageAccessToken")} placeholder="EAAxxxxxx…" className={FIELD_CLS + " pr-10"} />
                  <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showToken ? <EyeOff /> : <EyeOn />}</button>
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1">Generate a never-expiring token in Meta Business Suite → System Users</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">App Secret <span className="text-[#DC2626]">*</span> <span className="text-[10px] font-normal text-[#8B92A9]">(META_APP_SECRET)</span></label>
                <div className="relative">
                  <input type={showSecret ? "text" : "password"} value={form.appSecret} onChange={set("appSecret")} placeholder="Your Meta app secret" className={FIELD_CLS + " pr-10"} />
                  <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showSecret ? <EyeOff /> : <EyeOn />}</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Verify Token <span className="text-[#DC2626]">*</span> <span className="text-[10px] font-normal text-[#8B92A9]">(META_VERIFY_TOKEN)</span></label>
                  <input type="text" value={form.verifyToken} onChange={set("verifyToken")} placeholder="skyup_meta_2025" className={FIELD_CLS} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Graph API Version <span className="text-[10px] font-normal text-[#8B92A9]">(META_GRAPH_API_VERSION)</span></label>
                  <input type="text" value={form.graphApiVersion} onChange={set("graphApiVersion")} placeholder="v25.0" className={FIELD_CLS} />
                </div>
              </div>

              {/* ── Ad Performance (Insights) — optional ───────────────────── */}
              <div className="pt-2">
                <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-1">Ad Performance (optional)</p>
                <p className="text-[10px] text-[#8B92A9] mb-3">
                  Add an Ad Account ID + a token with <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded">ads_read</code> to see spend, CPM, CPC, CTR and cost-per-lead for this campaign in the Meta Performance report. Leave blank to skip.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Ad Account ID</label>
                    <input type="text" value={form.adAccountId} onChange={set("adAccountId")} placeholder="act_1234567890" className={FIELD_CLS} />
                    <p className="text-[10px] text-[#8B92A9] mt-1">Format <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded">act_</code> + the numeric ID (Business Settings → Ad Accounts).</p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Ads Token <span className="text-[10px] font-normal text-[#8B92A9]">(ads_read)</span></label>
                    <input type="password" value={form.adsToken} onChange={set("adsToken")} placeholder="System User token with ads_read" className={FIELD_CLS} />
                    <p className="text-[10px] text-[#8B92A9] mt-1">A System User token from Meta Business Manager with View Performance / ads_read on that ad account.</p>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-1">Conversions API — send-back (optional)</p>
                <p className="text-[10px] text-[#8B92A9] mb-3">
                  Lets the CRM tell Meta which leads actually converted, so ad delivery optimizes toward real customers instead of raw form fills.
                  Only active once your account has this feature enabled — ask before filling this in for a new client.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Pixel ID</label>
                    <input type="text" value={form.pixelId} onChange={set("pixelId")} placeholder="e.g. 1234567890123456" className={FIELD_CLS} />
                    <p className="text-[10px] text-[#8B92A9] mt-1">Events Manager → Data Sources → your Pixel.</p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Conversions API Access Token</label>
                    <input type="password" value={form.capiAccessToken} onChange={set("capiAccessToken")} placeholder="Generated from Events Manager → Settings → Conversions API" className={FIELD_CLS} />
                    <p className="text-[10px] text-[#8B92A9] mt-1">Different from the page token above — this one is pixel-scoped.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Form IDs <span className="text-[10px] font-normal text-[#8B92A9]">(optional — blank = accept all)</span></label>
                <input type="text" value={form.formIds} onChange={set("formIds")} placeholder="form_id_1, form_id_2" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Comma-separated. Find in Meta Ads Manager → Lead forms</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Form ID <span className="text-[10px] font-normal text-[#8B92A9]">(for this specific ad set)</span>
                </label>
                <input type="text" value={form.formId || ""} onChange={set("formId")} placeholder="e.g. 1234567890123456" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Each ad set has its own lead form. Find the Form ID in Meta Ads Manager → Lead forms.</p>
              </div>
              {form.adSetName.trim() && !form.formId.trim() && (form.formIds || "").trim() === "" && (
                <div className="bg-[#FEF3C7] dark:bg-[#3A2E0A] border border-[#FCD34D] dark:border-[#B45309] rounded-xl px-3 py-2.5 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-[#FBBF24] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D] leading-snug">
                    This ad set has no <span className="font-semibold">Form ID</span>. If multiple ad sets share the same Page,
                    leads can't be told apart and may be counted under the wrong campaign. Add the exact Meta Form ID for
                    this ad set so its leads are routed correctly.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
            <Info className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7] shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">Round-robin auto-assignment</p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">Every new lead from this campaign will be automatically assigned to the next available team member in rotation.</p>
            </div>
          </div>

          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid || loading} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Connecting…</>) : "Connect & Start Receiving Leads"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Meta Campaign modal ──────────────────────────────────────────────────
function EditMetaModal({ campaign, onClose, onUpdated }) {
  const [form, setForm] = useState({
    campaignName: campaign.name || "",
    pageId: campaign.pageId || "",
    pageAccessToken: "",
    appSecret: "",
    verifyToken: "",
    graphApiVersion: campaign.graphApiVersion || "v25.0",
    formIds: (campaign.formIds || []).join(", "),
    formId: campaign.formId || "",
    defaultStatus: campaign.defaultStatus || "New",
    adSetName: campaign.adSetName || "",
    parentCampaignName: campaign.parentCampaignName || "",
    adAccountId: campaign.adAccountId || "",
    adsToken: "",
    pixelId: campaign.pixelId || "",
    capiAccessToken: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.campaignName.trim() || !form.pageId.trim()) return;
    setLoading(true); setError("");
    try {
      const payload = {
        campaignName: form.campaignName.trim(),
        pageId: form.pageId.trim(),
        formIds: form.formIds ? form.formIds.split(",").map((s) => s.trim()).filter(Boolean) : [],
        formId: form.formId?.trim() || "",
        defaultStatus: form.defaultStatus || "New",
        graphApiVersion: form.graphApiVersion.trim() || "v25.0",
        adSetName: form.adSetName.trim() || undefined,
        parentCampaignName: form.parentCampaignName.trim() || undefined,
      };
      if (form.pageAccessToken.trim()) payload.pageAccessToken = form.pageAccessToken.trim();
      if (form.appSecret.trim()) payload.appSecret = form.appSecret.trim();
      if (form.verifyToken.trim()) payload.verifyToken = form.verifyToken.trim();
      // Ad performance (Insights) — adAccountId always sent (so it can be set/cleared);
      // adsToken only when a new one is entered (blank keeps the existing token).
      payload.adAccountId = form.adAccountId.trim();
      if (form.adsToken.trim()) payload.adsToken = form.adsToken.trim();
      // Conversions API send-back — pixelId always sent (so it can be set/cleared);
      // capiAccessToken only when a new one is entered (blank keeps existing token).
      payload.pixelId = form.pixelId.trim();
      if (form.capiAccessToken.trim()) payload.capiAccessToken = form.capiAccessToken.trim();
      await api.put(`/meta-config/${campaign._id}`, payload);
      setSuccess(true); onUpdated && onUpdated();
    } catch (err) { setError(err.response?.data?.message || err.message || "Failed to update campaign"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-[#059669]" /></div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Campaign updated!</h2>
        <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6"><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{form.campaignName}</span> has been updated successfully.</p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] transition">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center"><svg className="w-4 h-4 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg></div>
            <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Edit Meta Campaign</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{campaign.name}</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Campaign Info</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Campaign Name <span className="text-[#DC2626]">*</span></label><input type="text" value={form.campaignName} onChange={set("campaignName")} placeholder="e.g. Summer Sale 2025" className={FIELD_CLS} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Status</label><select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}><option>New</option><option>In Progress</option></select></div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Ad Set Name <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label>
                <input type="text" value={form.adSetName || ""} onChange={set("adSetName")} placeholder="e.g. Retargeting - Mumbai" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Differentiates multiple ad sets within the same campaign</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Parent Campaign <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label>
                <input type="text" value={form.parentCampaignName || ""} onChange={set("parentCampaignName")} placeholder="e.g. Summer Sale 2025" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Groups related ad sets together on this page</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Meta / Facebook Config</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Page ID <span className="text-[#DC2626]">*</span></label><input type="text" value={form.pageId} onChange={set("pageId")} placeholder="e.g. 123456789012345" className={FIELD_CLS} /></div>
              <div className="bg-[#FFFBEB] dark:bg-[#2D1F00] rounded-xl px-4 py-3 flex gap-3 border border-[#FCD34D]/30">
                <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">Leave token / secret fields blank to keep existing values.</p>
              </div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New Page Access Token <span className="text-[10px] font-normal text-[#8B92A9]">(leave blank to keep current)</span></label><div className="relative"><input type={showToken ? "text" : "password"} value={form.pageAccessToken} onChange={set("pageAccessToken")} placeholder="EAAxxxxxx…" className={FIELD_CLS + " pr-10"} /><button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showToken ? <EyeOff /> : <EyeOn />}</button></div></div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New App Secret <span className="text-[10px] font-normal text-[#8B92A9]">(leave blank to keep current)</span></label><div className="relative"><input type={showSecret ? "text" : "password"} value={form.appSecret} onChange={set("appSecret")} placeholder="Only if changing app secret" className={FIELD_CLS + " pr-10"} /><button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showSecret ? <EyeOff /> : <EyeOn />}</button></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New Verify Token <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.verifyToken} onChange={set("verifyToken")} placeholder="Leave blank to keep" className={FIELD_CLS} /></div>
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Graph API Version</label><input type="text" value={form.graphApiVersion} onChange={set("graphApiVersion")} placeholder="v25.0" className={FIELD_CLS} /></div>
              </div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Form IDs <span className="text-[10px] font-normal text-[#8B92A9]">(blank = accept all forms)</span></label><input type="text" value={form.formIds} onChange={set("formIds")} placeholder="form_id_1, form_id_2" className={FIELD_CLS} /></div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Form ID <span className="text-[10px] font-normal text-[#8B92A9]">(for this specific ad set)</span></label>
                <input type="text" value={form.formId || ""} onChange={set("formId")} placeholder="e.g. 1234567890123456" className={FIELD_CLS} />
                <p className="text-[10px] text-[#8B92A9] mt-1">Each ad set has its own lead form. Find the Form ID in Meta Ads Manager → Lead forms.</p>
              </div>
              {/* Ad Performance (Insights) — optional */}
              <div className="pt-1">
                <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-1">Ad Performance (optional)</p>
                <p className="text-[10px] text-[#8B92A9] mb-2">Spend / CPM / CPC / CTR / cost-per-lead in the Meta Performance report. Needs an <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded">ads_read</code> token.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Ad Account ID</label>
                    <input type="text" value={form.adAccountId || ""} onChange={set("adAccountId")} placeholder="act_1234567890" className={FIELD_CLS} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New Ads Token <span className="text-[10px] font-normal text-[#8B92A9]">(ads_read — blank keeps current)</span></label>
                    <input type="password" value={form.adsToken || ""} onChange={set("adsToken")} placeholder="Only if changing the ads_read token" className={FIELD_CLS} />
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-1">Conversions API — send-back</p>
                <p className="text-[10px] text-[#8B92A9] mb-2">Tells Meta which leads converted, so it can optimize delivery. Only active once your account has this feature enabled.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Pixel ID</label>
                    <input type="text" value={form.pixelId || ""} onChange={set("pixelId")} placeholder="e.g. 1234567890123456" className={FIELD_CLS} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New CAPI Access Token <span className="text-[10px] font-normal text-[#8B92A9]">(blank keeps current)</span></label>
                    <input type="password" value={form.capiAccessToken || ""} onChange={set("capiAccessToken")} placeholder="Only if changing the token" className={FIELD_CLS} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.campaignName.trim() || !form.pageId.trim() || loading} className="flex-1 py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving…</>) : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Google Campaign modal ─────────────────────────────────────────────────
function EditGoogleModal({ campaign, onClose, onUpdated }) {
  const [form, setForm] = useState({
    campaignName: campaign.name || "",
    googleKey: "",
    campaignId: campaign.campaignId || "",
    formId: campaign.formId || "",
    defaultStatus: campaign.defaultStatus || "New",
    cost: campaign.cost ?? "",
    impressions: campaign.impressions ?? "",
    clicks: campaign.clicks ?? "",
    avgDealValue: campaign.avgDealValue ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.campaignName.trim()) return;
    setLoading(true); setError("");
    try {
      const payload = {
        campaignName: form.campaignName.trim(),
        campaignId: form.campaignId.trim(),
        formId: form.formId.trim(),
        defaultStatus: form.defaultStatus || "New",
        cost: form.cost === "" ? 0 : Number(form.cost) || 0,
        impressions: form.impressions === "" ? 0 : Number(form.impressions) || 0,
        clicks: form.clicks === "" ? 0 : Number(form.clicks) || 0,
        avgDealValue: form.avgDealValue === "" ? 0 : Number(form.avgDealValue) || 0,
      };
      if (form.googleKey.trim()) payload.googleKey = form.googleKey.trim();
      await api.put(`/google-ads-config/${campaign._id}`, payload);
      setSuccess(true); onUpdated && onUpdated();
    } catch (err) { setError(err.response?.data?.message || err.message || "Failed to update campaign"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-[#059669]" /></div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Campaign updated!</h2>
        <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6"><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{form.campaignName}</span> has been updated successfully.</p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 transition">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF8F0] dark:bg-[#2D1A00] flex items-center justify-center"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg></div>
            <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Edit Google Ads Campaign</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{campaign.name}</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Campaign Info</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Campaign Name <span className="text-[#DC2626]">*</span></label><input type="text" value={form.campaignName} onChange={set("campaignName")} placeholder="e.g. Google Search — Branding Q2" className={FIELD_CLS} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Status</label><select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}><option>New</option><option>In Progress</option><option>Converted</option><option>Not Interested</option></select></div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Google Ads Config</p>
            <div className="space-y-3">
              <div className="bg-[#FFFBEB] dark:bg-[#2D1F00] rounded-xl px-4 py-3 flex gap-3 border border-[#FCD34D]/30">
                <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">Leave the Webhook Key blank to keep your existing key. Only fill it in to rotate credentials.</p>
              </div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New Webhook Key <span className="text-[10px] font-normal text-[#8B92A9]">(leave blank to keep current)</span></label><div className="relative"><input type={showKey ? "text" : "password"} value={form.googleKey} onChange={set("googleKey")} placeholder="Only if rotating key…" className={FIELD_CLS + " pr-10"} /><button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showKey ? <EyeOff /> : <EyeOn />}</button></div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Campaign ID <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.campaignId} onChange={set("campaignId")} placeholder="e.g. 1234567890" className={FIELD_CLS} /></div>
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Form ID <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.formId} onChange={set("formId")} placeholder="e.g. 9876543210" className={FIELD_CLS} /></div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Ad Performance</p>
            <p className="text-[10px] text-[#8B92A9] mb-3">Copy these from your Google Ads dashboard for this campaign & date range. CPC, CTR, CPM and cost-per-lead are calculated automatically in the Google Ads Performance report.</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Spend (₹)</label><input type="number" min="0" step="0.01" value={form.cost} onChange={set("cost")} placeholder="0" className={FIELD_CLS} /></div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Impressions</label><input type="number" min="0" step="1" value={form.impressions} onChange={set("impressions")} placeholder="0" className={FIELD_CLS} /></div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Clicks</label><input type="number" min="0" step="1" value={form.clicks} onChange={set("clicks")} placeholder="0" className={FIELD_CLS} /></div>
            </div>
            <div className="mt-3">
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Average Deal Value (₹)</label>
              <input type="number" min="0" step="0.01" value={form.avgDealValue} onChange={set("avgDealValue")} placeholder="e.g. 50000" className={FIELD_CLS} />
              <p className="text-[10px] text-[#8B92A9] mt-1">Average revenue per won customer. Revenue, ROAS, ROI and cost-per-acquisition are calculated from this × customers won.</p>
            </div>
          </div>
          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.campaignName.trim() || loading} className="flex-1 py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving…</>) : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connect Google Ads Campaign modal ─────────────────────────────────────────
function CreateGoogleModal({ onClose, onCreated }) {
  const empty = { campaignName: "", googleKey: "", campaignId: "", formId: "", defaultStatus: "New" };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const required = ["campaignName", "googleKey"];
  const isValid = required.every((k) => form[k].trim() !== "");

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true); setError("");
    try {
      const res = await api.post("/google-ads-config", {
        campaignName: form.campaignName.trim(), googleKey: form.googleKey.trim(),
        campaignId: form.campaignId.trim(), formId: form.formId.trim(),
        defaultStatus: form.defaultStatus || "New",
      });
      setSuccess(true); onCreated && onCreated(res.data.data);
    } catch (err) { setError(err.response?.data?.message || err.message || "Failed to connect campaign"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-[#059669]" /></div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Google Ads connected!</h2>
        <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">Leads from <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{form.campaignName}</span> will now flow into your CRM automatically via round-robin assignment.</p>
        <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3 text-left text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5 space-y-2 border border-[#E4E7EF] dark:border-[#262A38]">
          <p className="font-semibold text-[#4B5168] dark:text-[#9DA3BB] text-[12px] mb-1"> Add this webhook in Google Ads</p>
          <p className="text-[10px]">Go to: <span className="font-medium text-[#4B5168] dark:text-[#9DA3BB]">Google Ads → Lead Form → Lead delivery → Webhook</span></p>
          <div className="bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-2 border border-[#E4E7EF] dark:border-[#262A38] space-y-1">
            <p><span className="text-[#EA4335]">Webhook URL</span> → your-server.com/google-webhook</p>
            <p><span className="text-[#EA4335]">Key</span> → <span className="font-mono">{form.googleKey}</span></p>
          </div>
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 transition">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF8F0] dark:bg-[#2D1A00] flex items-center justify-center"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg></div>
            <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Connect Google Ads Campaign</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Auto-import leads · Round-robin assigned to your team</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Campaign Info</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Campaign Name <span className="text-[#DC2626]">*</span></label><input type="text" value={form.campaignName} onChange={set("campaignName")} placeholder="e.g. Google Search — Branding Q2" className={FIELD_CLS} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Status</label><select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}><option>New</option><option>In Progress</option><option>Converted</option><option>Not Interested</option></select></div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Google Ads Config</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Webhook Key <span className="text-[#DC2626]">*</span><span className="ml-1 text-[10px] font-normal text-[#8B92A9]">(set this as the Key in Google Ads)</span></label>
                <div className="relative"><input type={showKey ? "text" : "password"} value={form.googleKey} onChange={set("googleKey")} placeholder="e.g. skyup_google_2025" className={FIELD_CLS + " pr-10"} /><button type="button" onClick={() => setShowKey((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showKey ? <EyeOff /> : <EyeOn />}</button></div>
                <p className="text-[10px] text-[#8B92A9] mt-1">Create any secret string. Paste this exact value in Google Ads → Lead Form → Lead delivery → Webhook → Key.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Campaign ID <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.campaignId} onChange={set("campaignId")} placeholder="e.g. 1234567890" className={FIELD_CLS} /><p className="text-[10px] text-[#8B92A9] mt-1">Filter leads by campaign. Blank = accept all.</p></div>
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Form ID <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.formId} onChange={set("formId")} placeholder="e.g. 9876543210" className={FIELD_CLS} /><p className="text-[10px] text-[#8B92A9] mt-1">Filter leads by lead form. Blank = accept all.</p></div>
              </div>
            </div>
          </div>
          <div className="bg-[#FFF8F0] dark:bg-[#2D1A00] rounded-xl px-4 py-3 flex gap-3 border border-[#FBBF7A]/30">
            <Info className="w-4 h-4 text-[#EA4335] shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-semibold text-[#EA4335]">Webhook URL to enter in Google Ads</p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">After saving, go to <span className="font-medium">Google Ads → Lead Form → Lead delivery → Webhook</span> and enter:</p>
              <p className="text-[11px] font-mono bg-white dark:bg-[#0D0F14] rounded px-2 py-1 mt-1.5 border border-[#E4E7EF] dark:border-[#262A38] text-[#EA4335] break-all">https://your-server.com/google-webhook</p>
            </div>
          </div>
          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
            <RefreshCw className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7] shrink-0 mt-0.5" />
            <div><p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">Round-robin auto-assignment</p><p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">Every new Google lead will be automatically assigned to the next available team member in rotation.</p></div>
          </div>
          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid || loading} className="flex-1 py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Connecting…</>) : "Connect & Start Receiving Leads"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connect Website modal ─────────────────────────────────────────────────────
function CreateWebsiteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ sourceName: "", webhookSecret: "", pageUrl: "", defaultStatus: "New" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const isValid = form.sourceName.trim() !== "" && form.webhookSecret.trim() !== "";

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true); setError("");
    try {
      const res = await api.post("/website-config", {
        sourceName: form.sourceName.trim(), webhookSecret: form.webhookSecret.trim(),
        pageUrl: form.pageUrl.trim(), defaultStatus: form.defaultStatus || "New",
      });
      setSuccess(true); onCreated && onCreated(res.data.data);
    } catch (err) { setError(err.response?.data?.message || err.message || "Failed to connect website"); }
    finally { setLoading(false); }
  };

  if (success) {
    const webhookUrl = `${import.meta.env.VITE_API_URL.replace(/\/api$/, '')}/website-webhook`;
    const secret = form.webhookSecret;
    const sourceName = form.sourceName;

    const gtmScript = `<script>
(function () {
  var CRM_URL    = "${webhookUrl}";
  var SECRET_KEY = "${secret}";
  var dl   = window.dataLayer || [];
  var lead = null;
  for (var i = dl.length - 1; i >= 0; i--) {
    if (dl[i] && dl[i].event === "crm_lead") { lead = dl[i]; break; }
  }
  if (!lead || (!lead.form_name && !lead.form_mobile && !lead.form_email)) return;
  fetch(CRM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhook_secret: SECRET_KEY,
      name:    lead.form_name    || "Unknown",
      mobile:  lead.form_mobile  || "",
      email:   lead.form_email   || "",
      message: "[" + (lead.form_source || "${sourceName}") + "] " + (lead.form_message || ""),
    }),
  })
  .then(function(r){ console.log("CRM: lead sent ", r.status); })
  .catch(function(e){ console.warn("CRM: fetch failed", e); });
})();
<\/script>`;

    const dataLayerSnippet = `// Call this inside your form's onSubmit AFTER a successful API call
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event:        "crm_lead",
  form_name:    formData.name,
  form_mobile:  formData.mobile,
  form_email:   formData.email,
  form_message: formData.message,
  form_source:  "${sourceName}",
});`;

    const CopyBtn = ({ text }) => {
      const [copied, setCopied] = useState(false);
      return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 ${copied ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] hover:bg-[#dce7ff]"}`}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      );
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center"><Check className="w-5 h-5 text-[#059669]" /></div>
              <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none"><span className="text-[#16A34A]">{sourceName}</span> connected!</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Follow the 3 steps below to start receiving leads</p></div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="overflow-y-auto px-6 py-5 space-y-4">
            <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                <div className="flex-1"><p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Create GTM Tag</p><p className="text-[10px] text-[#8B92A9]">In GTM → Tags → New → Custom HTML → paste this script</p></div>
                <CopyBtn text={gtmScript} />
              </div>
              <pre className="px-4 py-3 text-[10px] font-mono text-[#059669] dark:text-[#4ADE80] bg-[#0D1117] dark:bg-[#080A10] overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">{gtmScript}</pre>
            </div>
            <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E]">
                <span className="w-6 h-6 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                <div className="flex-1"><p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Set GTM Trigger</p><p className="text-[10px] text-[#8B92A9]">In GTM → Triggering → New Trigger → set these exact values</p></div>
              </div>
              <div className="px-4 py-3 space-y-2 border-t border-[#E4E7EF] dark:border-[#262A38]">
                {[{ label: "Trigger Type", value: "Custom Event" }, { label: "Event Name", value: "crm_lead", mono: true }, { label: "Fires on", value: "All Custom Events" }].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] w-28 shrink-0">{label}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <span className={`flex-1 px-2.5 py-1.5 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] ${mono ? "font-mono text-[#7C3AED]" : ""}`}>{value}</span>
                      {mono && <CopyBtn text={value} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                <span className="w-6 h-6 rounded-full bg-[#D97706] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                <div className="flex-1"><p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add to your React form's <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded text-[10px]">onSubmit</code></p><p className="text-[10px] text-[#8B92A9]">Add this code AFTER your successful API call</p></div>
                <CopyBtn text={dataLayerSnippet} />
              </div>
              <pre className="px-4 py-3 text-[10px] font-mono text-[#F6A044] dark:text-[#FCD34D] bg-[#0D1117] dark:bg-[#080A10] overflow-x-auto leading-relaxed whitespace-pre-wrap">{dataLayerSnippet}</pre>
            </div>
          </div>
          <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] shrink-0">
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 transition">Done — Start receiving leads</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] dark:bg-[#052E1C] flex items-center justify-center"><Globe className="w-4 h-4 text-[#16A34A]" /></div>
            <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Connect Website Contact Form</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Auto-import leads · Round-robin assigned to your team</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Source Info</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Source Name <span className="text-[#DC2626]">*</span></label><input type="text" value={form.sourceName} onChange={set("sourceName")} placeholder="e.g. Contact Page, Homepage Form" className={FIELD_CLS} /></div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Contact Page URL <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.pageUrl} onChange={set("pageUrl")} placeholder="e.g. https://yourwebsite.com/contact" className={FIELD_CLS} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Status</label><select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}><option>New</option><option>In Progress</option><option>Converted</option><option>Not Interested</option></select></div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Webhook Config</p>
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Webhook Secret <span className="text-[#DC2626]">*</span></label>
              <div className="relative"><input type={showSecret ? "text" : "password"} value={form.webhookSecret} onChange={set("webhookSecret")} placeholder="e.g. skyup_website_2025" className={FIELD_CLS + " pr-10"} /><button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showSecret ? <EyeOff /> : <EyeOn />}</button></div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-2">Website Analytics <span className="text-[10px] font-normal text-[#8B92A9] normal-case tracking-normal">(optional)</span></p>
            <p className="text-[11px] text-[#8B92A9] mb-2.5">Connect Google Analytics to track website performance in Reports → Website Performance. You can also do this later.</p>
            <GoogleAnalyticsConnect />
          </div>
          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!isValid || loading} className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Connecting…</>) : "Connect & Start Receiving Leads"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Website modal ────────────────────────────────────────────────────────
function EditWebsiteModal({ campaign, onClose, onUpdated }) {
  const [form, setForm] = useState({
    sourceName: campaign.name || "",
    webhookSecret: "",
    pageUrl: campaign.pageUrl || "",
    defaultStatus: campaign.defaultStatus || "New",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.sourceName.trim()) return;
    setLoading(true); setError("");
    try {
      const payload = { sourceName: form.sourceName.trim(), pageUrl: form.pageUrl.trim(), defaultStatus: form.defaultStatus || "New" };
      if (form.webhookSecret.trim()) payload.webhookSecret = form.webhookSecret.trim();
      await api.put(`/website-config/${campaign._id}`, payload);
      setSuccess(true); onUpdated && onUpdated();
    } catch (err) { setError(err.response?.data?.message || err.message || "Failed to update"); }
    finally { setLoading(false); }
  };

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-[#059669]" /></div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Website source updated!</h2>
        <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6"><span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{form.sourceName}</span> has been updated successfully.</p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 transition">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] dark:bg-[#052E1C] flex items-center justify-center"><Globe className="w-4 h-4 text-[#16A34A]" /></div>
            <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Edit Website Source</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{campaign.name}</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Source Info</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Source Name <span className="text-[#DC2626]">*</span></label><input type="text" value={form.sourceName} onChange={set("sourceName")} placeholder="e.g. Contact Page" className={FIELD_CLS} /></div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Contact Page URL <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={form.pageUrl} onChange={set("pageUrl")} placeholder="e.g. https://yourwebsite.com/contact" className={FIELD_CLS} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Default Status</label><select value={form.defaultStatus} onChange={set("defaultStatus")} className={FIELD_CLS}><option>New</option><option>In Progress</option><option>Converted</option><option>Not Interested</option></select></div>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Webhook Config</p>
            <div className="bg-[#FFFBEB] dark:bg-[#2D1F00] rounded-xl px-4 py-3 flex gap-3 border border-[#FCD34D]/30 mb-3">
              <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">Leave the Webhook Secret blank to keep your existing secret.</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">New Webhook Secret <span className="text-[10px] font-normal text-[#8B92A9]">(leave blank to keep current)</span></label>
              <div className="relative"><input type={showSecret ? "text" : "password"} value={form.webhookSecret} onChange={set("webhookSecret")} placeholder="Only if rotating secret…" className={FIELD_CLS + " pr-10"} /><button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">{showSecret ? <EyeOff /> : <EyeOn />}</button></div>
            </div>
          </div>
          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.sourceName.trim() || loading} className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Saving…</>) : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Email Campaign Modal ──────────────────────────────────────────────────────
function EmailCampaignModal({ campaigns, onClose }) {
  const [mode, setMode] = useState("campaign");
  const [form, setForm] = useState({ campaign: "" });
  const [leadCount, setLeadCount] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [singleLead, setSingleLead] = useState({ name: "", email: "" });
  const [csvText, setCsvText] = useState("name,email\nRahul Sharma,rahul@gmail.com\nPriya Patel,priya@gmail.com");
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvError, setCsvError] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState(
    "<p>Hi {{name}},</p>\n<p>We are reaching out about our <strong>{{campaign}}</strong> campaign.</p>\n<p>Please feel free to contact us at any time.</p>\n<p>Regards,<br/>The Team</p>",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const campaignNames = [...new Set(campaigns.map((c) => c.name).filter(Boolean))];
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
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4"><Check className="w-7 h-7 text-[#059669]" /></div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Campaign Sent!</h2>
        <div className="grid grid-cols-3 gap-3 my-5">
          {[{ label: "Sent", value: result.sent ?? 1, color: "#059669" }, { label: "Failed", value: result.failed ?? 0, color: "#DC2626" }, { label: "Total", value: result.total ?? 1, color: "#2563EB" }].map((s) => (
            <div key={s.label} className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-3 text-center border border-[#E4E7EF] dark:border-[#262A38]">
              <div className="text-[22px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-[#8B92A9] uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 transition">Done</button>
      </div>
    </div>
  );

  const isValid = subject.trim() && bodyTemplate.trim() && (
    mode === "campaign" ? !!form.campaign :
    mode === "single" ? !!singleLead.email && !!singleLead.name :
    !!csvParsed
  );

  const recipientLabel = mode === "campaign" && leadCount !== null ? `${leadCount} leads` :
    mode === "single" && singleLead.email ? "1 recipient" :
    mode === "csv" && csvParsed ? `${csvParsed.length} recipients` : "recipients";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[94vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] dark:bg-[#1E1040] flex items-center justify-center"><Mail className="w-4 h-4 text-[#7C3AED]" /></div>
            <div><h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Send Email</h2><p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">Personalized bulk emails via Brevo</p></div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="px-6 pt-5 pb-0 shrink-0">
          <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-2">Send to</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "campaign", label: "Campaign leads", icon: <Users className="w-3.5 h-3.5" /> },
              { key: "single", label: "Single lead", icon: <User className="w-3.5 h-3.5" /> },
              { key: "csv", label: "CSV import", icon: <UploadCloud className="w-3.5 h-3.5" /> },
            ].map((m) => (
              <button key={m.key} onClick={() => { setMode(m.key); setError(""); }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition ${mode === m.key ? "border-[#7C3AED] bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED]" : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#7C3AED]/50"}`}>
                {m.icon}{m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {mode === "campaign" && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Target source</p>
              <div className="flex gap-2">
                <select value={form.campaign} onChange={(e) => { setForm((p) => ({ ...p, campaign: e.target.value })); setLeadCount(null); }} className={FIELD_CLS + " flex-1"}>
                  <option value="">— Select a campaign —</option>
                  {campaignNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={handlePreview} disabled={!form.campaign || previewing} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#7C3AED] hover:border-[#7C3AED] disabled:opacity-40 transition flex items-center gap-1.5 shrink-0">
                  {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeIcon className="w-3.5 h-3.5" />}
                  Preview
                </button>
              </div>
              {leadCount !== null && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                  <span className="text-[#7C3AED] font-semibold">{leadCount} leads</span>
                  <span className="text-[#8B92A9]">with email addresses will receive this campaign</span>
                </div>
              )}
            </div>
          )}
          {mode === "single" && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Recipient details</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Full name <span className="text-[#DC2626]">*</span></label><input type="text" value={singleLead.name} onChange={(e) => setSingleLead((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Rahul Sharma" className={FIELD_CLS} /></div>
                <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Email address <span className="text-[#DC2626]">*</span></label><input type="email" value={singleLead.email} onChange={(e) => setSingleLead((p) => ({ ...p, email: e.target.value }))} placeholder="rahul@gmail.com" className={FIELD_CLS} /></div>
              </div>
            </div>
          )}
          {mode === "csv" && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">CSV recipients</p>
              <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); setCsvParsed(null); setCsvError(""); }} rows={6} className={FIELD_CLS + " font-mono text-[12px] resize-y"} placeholder={"name,email\nRahul Sharma,rahul@gmail.com"} />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={parseCSV} className="px-4 py-2 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] text-[12px] font-semibold hover:bg-[#dce7ff] transition">Parse CSV</button>
                {csvParsed && <span className="text-[12px] text-[#059669] font-semibold">{csvParsed.length} valid recipients found</span>}
              </div>
              {csvError && <p className="text-[11px] text-[#DC2626] mt-1.5">{csvError}</p>}
            </div>
          )}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Email details</p>
            <div className="space-y-3">
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Subject <span className="text-[#DC2626]">*</span></label><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Special offer just for you, {{name}}!" className={FIELD_CLS} /></div>
              <div><label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">From name <span className="text-[10px] font-normal text-[#8B92A9]">(optional)</span></label><input type="text" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="e.g. SkyUp CRM Team" className={FIELD_CLS} /></div>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-2">Available merge tags</p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_TAGS.map((tag) => (
                <button key={tag} onClick={() => insertTag(tag)} className="px-2.5 py-1 rounded-lg bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[11px] font-mono font-semibold hover:bg-[#ede9fe] transition">{tag}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Email body (HTML) <span className="text-[#DC2626]">*</span></p>
            <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={10} placeholder="<p>Hi {{name}}, ...</p>" className={FIELD_CLS + " font-mono text-[12px] resize-y"} />
          </div>
          {error && <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]"> {error}</div>}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">Cancel</button>
          <button onClick={handleSend} disabled={!isValid || loading} className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {loading ? (<><Loader2 className="w-4 h-4 animate-spin" />Sending…</>) : (<><Send className="w-4 h-4" />Send to {recipientLabel}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Qualification Modal (Meta Ad Set only) ────────────────────────────────────
function QualificationModal({ adSet, onClose, onSaved }) {
  const [questions, setQuestions] = useState([]);
  const [rules, setRules] = useState([]);
  const [thresholds, setThresholds] = useState({ hot: 80, warm: 50 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [existingRules, setExistingRules] = useState(null);
  // Set when a previously-saved rule-set fails the 100-point rule on load,
  // so we can show an admin "needs correction before activation" warning.
  const [migrationWarning, setMigrationWarning] = useState(false);

  // Fetch form questions + existing rules on open
  useEffect(() => {
    if (!adSet) return;
    setLoading(true);
    setError("");

    const fetchData = async () => {
      try {
        // Try to fetch existing qualification rules for this ad set
        let existing = null;
        try {
          const rulesRes = await api.get(`/meta-qualification/${adSet._id}`);
          existing = rulesRes.data?.data || rulesRes.data || null;
        } catch (_) {
          // No rules yet — that's fine
        }

        // Fetch lead form questions via the formId saved on the ad set
        let formQuestions = [];
        if (adSet.formId) {
          try {
            const formRes = await api.get(`/meta-config/${adSet._id}/form-questions`);
            formQuestions = formRes.data?.questions || formRes.data || [];
          } catch (_) {
            // formId present but questions not fetchable (token issues etc.)
            formQuestions = [];
          }
        }

        setQuestions(formQuestions);
        setExistingRules(existing);

        if (existing) {
          // Restore saved state
          setRules(existing.rules || []);
          setThresholds(existing.thresholds || { hot: 80, warm: 50 });
          // Auto-migration: if any saved question doesn't total 100, warn the
          // admin that the campaign must be corrected before it stays active.
          const invalid = (existing.rules || []).some(
            (r) =>
              (r.answers || []).reduce((s, a) => s + (Number(a.score) || 0), 0) !==
              100
          );
          if (invalid) setMigrationWarning(true);
        } else if (formQuestions.length > 0) {
          // Build a blank rule entry per question.
          // _keyFromMeta = true signals handleLabelChange to NOT overwrite questionKey
          // when the admin edits the display label — the key must stay as Meta's field name
          // so it matches what arrives in field_data[].name on the webhook.
          setRules(
            formQuestions.map((q) => ({
              questionKey: q.key || q.label,
              questionLabel: q.label,
              _keyFromMeta: !!q.key,
              answers: (q.options || []).map((opt) => ({ value: opt, score: 0 })),
            }))
          );
        }
      } catch (err) {
        setError("Failed to load qualification data. You can still configure rules manually.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [adSet]);

  const handleScoreChange = (rIdx, aIdx, val) => {
    setRules((prev) => {
      const next = prev.map((r, ri) => {
        if (ri !== rIdx) return r;
        return {
          ...r,
          answers: r.answers.map((a, ai) =>
            ai === aIdx ? { ...a, score: Number(val) || 0 } : a
          ),
        };
      });
      return next;
    });
  };

  const handleAddQuestion = () => {
    setRules((prev) => [
      ...prev,
      { questionKey: "", questionLabel: "", answers: [{ value: "", score: 0 }] },
    ]);
  };

  const handleAddAnswer = (rIdx) => {
    setRules((prev) =>
      prev.map((r, ri) =>
        ri === rIdx ? { ...r, answers: [...r.answers, { value: "", score: 0 }] } : r
      )
    );
  };

  const handleRemoveAnswer = (rIdx, aIdx) => {
    setRules((prev) =>
      prev.map((r, ri) =>
        ri === rIdx
          ? { ...r, answers: r.answers.filter((_, ai) => ai !== aIdx) }
          : r
      )
    );
  };

  const handleRemoveQuestion = (rIdx) => {
    setRules((prev) => prev.filter((_, ri) => ri !== rIdx));
  };

  const handleLabelChange = (rIdx, val) => {
    setRules((prev) =>
      prev.map((r, ri) => {
        if (ri !== rIdx) return r;
        // For manually added questions (no pre-set key), keep key in sync with label.
        // For auto-loaded questions (key already set from Meta form), only update the label.
        const isManual = !r._keyFromMeta;
        return {
          ...r,
          questionLabel: val,
          questionKey: isManual ? val : r.questionKey,
        };
      })
    );
  };

  const handleAnswerValueChange = (rIdx, aIdx, val) => {
    setRules((prev) =>
      prev.map((r, ri) =>
        ri === rIdx
          ? { ...r, answers: r.answers.map((a, ai) => (ai === aIdx ? { ...a, value: val } : a)) }
          : r
      )
    );
  };

  // Per-question option totals (must each equal exactly 100).
  const questionTotals = rules.map((r) =>
    (r.answers || []).reduce((s, a) => s + (Number(a.score) || 0), 0)
  );
  const allQuestionsValid =
    rules.length > 0 && questionTotals.every((t) => t === 100);
  const invalidCount = questionTotals.filter((t) => t !== 100).length;

  const handleSave = async () => {
    // Guard: do not allow saving / activation unless every question totals 100.
    if (!allQuestionsValid) {
      setError(
        `Each question's answer options must total exactly 100 points. ` +
          `${invalidCount} question${invalidCount === 1 ? "" : "s"} still need${
            invalidCount === 1 ? "s" : ""
          } correction.`
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      // Strip the UI-only _keyFromMeta flag before sending to the backend
      const cleanRules = rules.map(({ _keyFromMeta, ...r }) => r);
      await api.post(`/meta-qualification/${adSet._id}`, {
        rules: cleanRules,
        thresholds,
        adSetId: adSet._id,
        adSetName: adSet.adSetName || adSet.name,
        formId: adSet.formId || "",
      });
      setMigrationWarning(false);
      setSuccess(true);
      onSaved && onSaved();
    } catch (err) {
      // Backend rejects rule-sets that don't total 100 (422) with a validation payload.
      const v = err.response?.data?.validation;
      if (v && Array.isArray(v.errors) && v.errors.length > 0) {
        const labels = v.errors
          .map((e) => `“${e.questionLabel}” (= ${e.total})`)
          .join(", ");
        setError(
          `Each question must total exactly 100 points. Fix: ${labels}.`
        );
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to save qualification rules"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // Maximum possible score is fixed: number of questions × 100.
  const maxPossibleScore = rules.length * 100;

  const hotMin = Math.round((thresholds.hot / 100) * maxPossibleScore);
  const warmMin = Math.round((thresholds.warm / 100) * maxPossibleScore);

  if (success) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-[#059669]" />
        </div>
        <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Qualification rules saved!</h2>
        <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
          New leads from <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{adSet.adSetName || adSet.name}</span> will be automatically scored and categorised as Hot, Warm, or Cold.
        </p>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Hot", color: "#DC2626", bg: "bg-[#FEF2F2]", score: `≥ ${hotMin} pts` },
            { label: "Warm", color: "#D97706", bg: "bg-[#FFFBEB]", score: `≥ ${warmMin} pts` },
            { label: "Cold", color: "#2563EB", bg: "bg-[#EEF3FF]", score: `< ${warmMin} pts` },
          ].map((t) => (
            <div key={t.label} className={`${t.bg} rounded-xl px-3 py-3 text-center`}>
              <div className="text-[15px] font-bold" style={{ color: t.color }}>{t.label}</div>
              <div className="text-[10px] text-[#8B92A9] mt-0.5">{t.score}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] transition">Done</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[94vh]" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[#E1306C]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">Qualification Rules</h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{adSet.adSetName || adSet.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#8B92A9] gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading form questions…
            </div>
          ) : (
            <>
              {/* Explainer */}
              <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
                <Info className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">How qualification works</p>
                  <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                    Each question's answer options must add up to exactly <span className="font-bold">100 points</span>.
                    A lead earns the points of the answer they pick. Maximum Score = number of questions × 100, and the
                    lead's percentage = (score ÷ max) × 100. Hot/Warm thresholds below categorise each lead.
                  </p>
                </div>
              </div>

              {/* Auto-migration warning — existing campaign with invalid totals */}
              {migrationWarning && (
                <div className="bg-[#FFFBEB] dark:bg-[#2D1F05] border border-[#FDE68A] dark:border-[#854D0E] rounded-xl px-4 py-3 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-[#D97706] dark:text-[#FBBF24] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#B45309] dark:text-[#FBBF24]">
                      This campaign needs correction before activation
                    </p>
                    <p className="text-[11px] text-[#92660C] dark:text-[#FCD34D] mt-0.5">
                      It was created under the old scoring system. One or more questions don't total 100 points.
                      Adjust the highlighted questions below so each totals exactly 100, then save to re-activate scoring.
                    </p>
                  </div>
                </div>
              )}

              {/* Thresholds */}
              <div>
                <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">Score Thresholds (%)</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: "hot", label: "Hot threshold", color: "#DC2626", bg: "bg-[#FEF2F2]", desc: "Min % score to be Hot" },
                    { key: "warm", label: "Warm threshold", color: "#D97706", bg: "bg-[#FFFBEB]", desc: "Min % score to be Warm" },
                  ].map((t) => (
                    <div key={t.key} className={`${t.bg} rounded-xl px-4 py-3`}>
                      <label className="block text-[12px] font-semibold mb-1" style={{ color: t.color }}>{t.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={thresholds[t.key]}
                          onChange={(e) => setThresholds((p) => ({ ...p, [t.key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                          className="w-20 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none"
                          style={{ borderColor: t.color + "60" }}
                        />
                        <span className="text-[13px] font-bold" style={{ color: t.color }}>%</span>
                      </div>
                      <p className="text-[10px] text-[#8B92A9] mt-1">{t.desc}</p>
                      {maxPossibleScore > 0 && (
                        <p className="text-[10px] font-semibold mt-0.5" style={{ color: t.color }}>
                          = {Math.round((thresholds[t.key] / 100) * maxPossibleScore)} pts of {maxPossibleScore} max
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "Hot", Icon: Flame, color: "#DC2626", bg: "bg-[#FEF2F2]", desc: `Score ≥ ${thresholds.hot}%` },
                    { label: "Warm", Icon: Thermometer, color: "#D97706", bg: "bg-[#FFFBEB]", desc: `Score ≥ ${thresholds.warm}% and < ${thresholds.hot}%` },
                    { label: "Cold", Icon: Snowflake, color: "#2563EB", bg: "bg-[#EEF3FF]", desc: `Score < ${thresholds.warm}%` },
                  ].map((t) => (
                    <div key={t.label} className={`${t.bg} rounded-xl px-3 py-2 text-center`}>
                      <div className="text-[12px] font-bold inline-flex items-center gap-1 justify-center" style={{ color: t.color }}><t.Icon className="w-3 h-3" />{t.label}</div>
                      <div className="text-[10px] text-[#8B92A9] mt-0.5">{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Questions & Scores */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">
                    Questions & Answer Scores
                    {questions.length > 0 && (
                      <span className="ml-2 normal-case font-normal text-[#059669]">— loaded from lead form</span>
                    )}
                  </p>
                  <button
                    onClick={handleAddQuestion}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] text-[11px] font-semibold hover:bg-[#dce7ff] transition"
                  >
                    <Plus className="w-3 h-3" />
                    Add question
                  </button>
                </div>

                {rules.length === 0 && (
                  <div className="text-center py-10 rounded-2xl border-2 border-dashed border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] dark:text-[#565C75]">
                    <div className="mb-2 flex justify-center text-[#8B92A9]"><ClipboardList className="w-8 h-8" strokeWidth={1.5} /></div>
                    <p className="text-[13px] font-medium">No questions yet</p>
                    <p className="text-[11px] mt-1">
                      {adSet.formId
                        ? "Questions will auto-load if the form has options. You can also add manually."
                        : "Add a Form ID to the ad set to auto-load questions, or add manually."}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {rules.map((rule, rIdx) => {
                    const qTotal = questionTotals[rIdx] ?? 0;
                    const qValid = qTotal === 100;
                    return (
                    <div key={rIdx} className={`bg-[#F8F9FC] dark:bg-[#13161E] rounded-2xl border overflow-hidden ${qValid ? "border-[#E4E7EF] dark:border-[#262A38]" : "border-[#FCA5A5] dark:border-[#7F1D1D]"}`}>
                      {/* Question header */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
                        <span className="w-5 h-5 rounded-full bg-[#E1306C]/10 text-[#E1306C] text-[10px] font-bold flex items-center justify-center shrink-0">
                          {rIdx + 1}
                        </span>
                        <input
                          value={rule.questionLabel}
                          onChange={(e) => handleLabelChange(rIdx, e.target.value)}
                          placeholder="Question label (e.g. What is your budget?)"
                          className="flex-1 bg-transparent text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none"
                        />
                        {/* Live option total — must equal exactly 100 */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                            qValid
                              ? "bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]"
                              : "bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626] dark:text-[#F87171]"
                          }`}
                          title="Each question's options must total exactly 100"
                        >
                          {qValid ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                          {qTotal} / 100
                        </span>
                        <button
                          onClick={() => handleRemoveQuestion(rIdx)}
                          className="p-1 rounded-lg text-[#8B92A9] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Answer options */}
                      <div className="px-4 py-3 space-y-2">
                        {rule.answers.map((ans, aIdx) => (
                          <div key={aIdx} className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-white dark:bg-[#1A1D27] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2">
                              <input
                                value={ans.value}
                                onChange={(e) => handleAnswerValueChange(rIdx, aIdx, e.target.value)}
                                placeholder={`Answer option ${aIdx + 1}`}
                                className="flex-1 bg-transparent text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] rounded-xl border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2 w-24 shrink-0">
                              <input
                                type="number"
                                min="0"
                                value={ans.score}
                                onChange={(e) => handleScoreChange(rIdx, aIdx, e.target.value)}
                                className="w-12 bg-transparent text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none text-right"
                              />
                              <span className="text-[10px] text-[#8B92A9]">pts</span>
                            </div>
                            <button
                              onClick={() => handleRemoveAnswer(rIdx, aIdx)}
                              className="p-1.5 rounded-lg text-[#8B92A9] hover:text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#2D0A0A] transition shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAddAnswer(rIdx)}
                          className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-[#8B92A9] hover:text-[#2563EB] transition"
                        >
                          <Plus className="w-3 h-3" />
                          Add answer
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] shrink-0">
          {rules.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">
                Maximum Score:{" "}
                <span className="font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                  {maxPossibleScore} pts
                </span>{" "}
                <span className="text-[#8B92A9]">({rules.length} × 100)</span>
              </span>
              <span
                className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                  allQuestionsValid
                    ? "text-[#059669] dark:text-[#34D399]"
                    : "text-[#DC2626] dark:text-[#F87171]"
                }`}
              >
                {allQuestionsValid ? (
                  <><Check className="w-3.5 h-3.5" />All questions total 100</>
                ) : (
                  <><AlertCircle className="w-3.5 h-3.5" />{invalidCount} question{invalidCount === 1 ? "" : "s"} ≠ 100</>
                )}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || rules.length === 0 || !allQuestionsValid}
            title={!allQuestionsValid ? "Each question's options must total exactly 100 points" : undefined}
            className="flex-1 py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
            ) : (
              <><Check className="w-4 h-4" />Save Qualification Rules</>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ad Set Leads Panel (Level 2 inline leads view) ────────────────────────────
function AdSetLeadsPanel({ adSet }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adSet) return;
    setLoading(true);
    // Use adSetName param so the backend scopes results to this specific ad set,
    // not all leads under the parent campaign name.
    const url = adSet.adSetName
      ? `/lead/by-campaign?campaign=${encodeURIComponent(adSet.name)}&adSetName=${encodeURIComponent(adSet.adSetName)}`
      : `/lead/by-campaign?campaign=${encodeURIComponent(adSet.name)}`;
    api.get(url)
      .then((res) => setLeads(Array.isArray(res.data) ? res.data : res.data?.data || []))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, [adSet]);

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-[#8B92A9] gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading leads…
    </div>
  );

  if (!leads.length) return (
    <div className="text-center py-14 text-[#8B92A9] dark:text-[#565C75]">
      <div className="mb-2 flex justify-center text-[#8B92A9]"><Inbox className="w-9 h-9" strokeWidth={1.5} /></div>
      <p className="text-[13px] font-medium">No leads yet for this ad set.</p>
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
        {leads.length} lead{leads.length !== 1 ? "s" : ""} from this ad set
      </p>
      {leads.map((l, i) => {
        const name = l.name || "Unknown";
        const phone = l.phone || l.mobile || "—";
        const agent = l.agent || (l.user && (l.user.name || "Assigned")) || "Unassigned";
        const status = l.status || "New";
        const ls = LEAD_STATUS_STYLE[status] || LEAD_STATUS_STYLE["New"];
        const temp = l.temperature || null;
        const lt = temp ? LEAD_TEMP_STYLE[temp] || null : null;
        return (
          <div key={i} className="bg-white dark:bg-[#1A1D27] rounded-xl p-3.5 border border-[#E4E7EF] dark:border-[#262A38] hover:shadow-sm transition">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[11px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                  {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{name}</div>
                  <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 font-mono">{maskPhone(phone)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {lt && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lt.bg} ${lt.text}`}>{lt.icon} {temp}</span>}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ls.bg} ${ls.text}`}>{status}</span>
              </div>
            </div>
            {maskEmail(l.email) && (
              <div className="flex items-center gap-1 mb-1">
                <Mail className="w-3 h-3 text-[#059669] shrink-0" />
                <span className="text-[11px] text-[#059669] font-mono truncate">{maskEmail(l.email)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#8B92A9]">Assigned: <span className="text-[#4B5168] dark:text-[#9DA3BB] font-medium">{agent}</span></span>
              <span className="text-[#8B92A9] italic">{l.remark || "—"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Campaign Card ─────────────────────────────────────────────────────────────
// NOTE: No "Sync from Meta" button here — sync lives only on the group header
function CampaignCard({ c, onSelect, onEdit, onToggle, onDelete, onQualification, isSuperAdmin, adminList, onAssign }) {
  const st = STATUS_STYLE[c.status] || STATUS_STYLE.Active;
  const ch = CHANNEL_STYLE[c.channel] || CHANNEL_STYLE.Meta;
  const editHoverCls = c._isMeta ? "hover:border-[#E1306C] hover:text-[#E1306C]" : c._isWebsite ? "hover:border-[#16A34A] hover:text-[#16A34A]" : "hover:border-[#EA4335] hover:text-[#EA4335]";
  const isMetaAdSet = c._isMeta && !!c.adSetName;
  const isUnowned = !c.createdBy || (typeof c.createdBy === "object" && !c.createdBy._id && !c.createdBy);

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-shadow">
      <div className="h-1 w-full" style={{ background: c.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ch.bg} ${ch.text}`}>{c.channel}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${st.bg} ${st.text}`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: st.dot }} />{c.status}
              </span>
              {c._isMeta && c.pausedByMeta && !c.isActive && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF1F2] dark:bg-[#3B0A12] text-[#E1306C] dark:text-[#F472B6]"
                  title={`Paused on Meta — ad set: ${c.metaAdsetStatus || "n/a"}, campaign: ${c.metaCampaignStatus || "n/a"}`}
                >
                  Paused on Meta
                </span>
              )}
              {c.adSetName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400">
                  Ad Set: {c.adSetName}
                </span>
              )}
            </div>
            <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-snug truncate">{c.name}</h3>
            {c.parentCampaignName && !c._inGroup && (
              <p className="text-[10px] text-[#8B92A9] mt-0.5">Parent: {c.parentCampaignName}</p>
            )}
            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{c.date}</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between gap-3 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-3 border border-[#E4E7EF] dark:border-[#262A38]">
            <div className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{fmt(c.leads)}</div>
            <span className="text-[22px] font-semibold text-[#8B92A9] dark:text-[#565C75] tracking-wide">Leads</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          <RefreshCw className="w-3 h-3 text-[#2563EB] dark:text-[#4F8EF7] shrink-0" />
          <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] truncate">
            Round-robin · {c._isMeta ? "Page ID: " : c._isWebsite ? "Source: " : "Key: "}
            <span className="font-mono">{c._isMeta ? c.pageId : c._isWebsite ? (c.pageUrl || "Webhook") : (c.googleKey ? "••••••" : "—")}</span>
          </span>
        </div>

        {/* Super-admin: show unowned badge + assign button */}
        {isSuperAdmin && isUnowned && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate">No owner — visible to all admins</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onAssign && onAssign(c); }}
              className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold transition whitespace-nowrap"
            >
              Assign
            </button>
          </div>
        )}

        {/* Super-admin: show owner name when assigned */}
        {isSuperAdmin && c.createdBy && (
          <div className="flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/20">
            <Users className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium truncate">
              Owner: <span className="font-bold">{c.createdByName || "Admin"}</span>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onAssign && onAssign(c); }}
              className="ml-auto text-[10px] text-emerald-600 hover:underline font-semibold shrink-0"
            >
              Reassign
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <button onClick={() => onSelect(c)} className="flex-1 py-2 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-semibold hover:bg-[#dce7ff] dark:hover:bg-[#1e2d52] transition">
            View leads ({c.leads})
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(c); }} className={`px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] transition ${editHoverCls}`} title="Edit campaign"><EditIcon /></button>
          <button
            onClick={(e) => { e.stopPropagation(); onQualification && onQualification(c); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:border-[#E1306C] hover:text-[#E1306C] transition"
            title="Qualification rules"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Qualification
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
// ── Main Campaigns page ───────────────────────────────────────────────────────
export default function Campaigns() {
  const { hasFeature } = usePlanFeatures();
  const { getRole } = require("../data/dataService") ? (() => { try { return require("../data/dataService"); } catch { return {}; } })() : {};

  // ── Role detection ──────────────────────────────────────────────────────────
  const isSuperAdmin = (() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const role = (user.role || "").toLowerCase();
      return role === "super_admin" || role === "superadmin";
    } catch { return false; }
  })();

  // ── Admin list (fetched only for super_admin to populate assign dropdown) ───
  const [adminList, setAdminList] = useState([]);
  const [assigningCampaign, setAssigningCampaign] = useState(null); // { c, selectedAdminId }
  const [assignLoading, setAssignLoading] = useState(false);

  // Per-campaign-type feature flags — each is independently controllable
  const canMeta    = hasFeature("meta-ads");
  const canGoogle  = hasFeature("google-ads");
  const canWebsite = hasFeature("website-tracking");

  const [campaigns, setCampaigns] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateGoogle, setShowCreateGoogle] = useState(false);
  const [showCreateWebsite, setShowCreateWebsite] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [showEmailCampaign, setShowEmailCampaign] = useState(false);
  const [syncTarget, setSyncTarget] = useState(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  // ── Navigation state ────────────────────────────────────────────────────────
  // selectedParent: null = Campaigns root, string = Ad Sets page (Level 1)
  // selectedAdSet:  null = no ad set selected, object = Ads page (Level 2)
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedAdSet, setSelectedAdSet] = useState(null);
  const [qualificationAdSet, setQualificationAdSet] = useState(null); // Meta Ad Set qualification modal

  // ── Derived: is Meta connected? (at least one Meta config exists) ──────────
  // This is the ONLY variable that controls the Sync Meta button visibility.
  // It must be computed AFTER campaigns are loaded.
  const isMetaConnected = campaigns.some((c) => c._isMeta);

  // Fetch admin list once for super_admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get("/admin/").then(r => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.admins || r.data?.data || []);
      setAdminList(list.filter(a => a.role === "admin"));
    }).catch(() => {});
  }, [isSuperAdmin]);

  const fetchCampaigns = useCallback(async () => {
    setPageLoading(true);
    try {
      const [metaRes, googleRes, websiteRes] = await Promise.allSettled([
        api.get("/meta-config"),
        api.get("/google-ads-config"),
        api.get("/website-config"),
      ]);

      const metaList = metaRes.status === "fulfilled" ? (Array.isArray(metaRes.value.data) ? metaRes.value.data : metaRes.value.data?.data || []) : [];
      const googleList = googleRes.status === "fulfilled" ? (Array.isArray(googleRes.value.data) ? googleRes.value.data : googleRes.value.data?.data || []) : [];
      const websiteList = websiteRes.status === "fulfilled" ? (websiteRes.value?.data?.data || []) : [];

      const metaLeadCounts = await Promise.allSettled(
        metaList.map((cfg) => {
          // Scope strictly by metaConfigId so each ad set (and each bare-campaign
          // config) counts ONLY its own leads — never the whole campaign name.
          // Multiple configs can share the same campaignName (a campaign with
          // several ad sets, or "skyup_ads" + an ad set under it). Counting by
          // campaign name alone piled every sibling's leads onto the first card.
          // metaConfigId is unique per config and is stamped on every webhook
          // lead (utils/metaHelper.mapToLeadSchema), so it is the correct key.
          // adSetName is still sent so the backend can also fold in any legacy
          // leads (metaConfigId:null) that predate the metaConfigId field.
          const adSetParam =
            cfg.adSetName
              ? `&adSetName=${encodeURIComponent(cfg.adSetName)}`
              : "";
          const cfgParam = cfg._id
            ? `&metaConfigId=${encodeURIComponent(cfg._id)}`
            : "";
          return api
            .get(`/lead/by-campaign?campaign=${encodeURIComponent(cfg.campaignName)}${adSetParam}${cfgParam}`)
            .then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || []).length)
            .catch(() => 0);
        }),
      );

      const shapedMeta = metaList.map((cfg, idx) => ({
        _id: cfg._id,
        _isMeta: true,
        id: cfg._id,
        name: cfg.campaignName,
        channel: "Meta",
        // Reflect the REAL Meta state: a card is Active only when the CRM toggle
        // is on AND Meta hasn't reported the ad set / campaign / form as paused
        // or archived (metaActive). Once the status sync runs, paused campaigns
        // show as Paused here instead of always showing Active.
        status: (cfg.isActive && cfg.metaActive !== false) ? "Active" : "Paused",
        sent: cfg.sent ?? 0,
        leads: metaLeadCounts[idx]?.status === "fulfilled" ? metaLeadCounts[idx].value : 0,
        converted: cfg.converted ?? 0,
        cost: cfg.cost ?? 0,
        date: fmtDate(cfg.createdAt),
        createdAt: cfg.createdAt,
        color: META_COLORS[idx % META_COLORS.length],
        pageId: cfg.pageId,
        company: cfg.company,
        isActive: cfg.isActive,
        formIds: cfg.formIds || [],
        defaultStatus: cfg.defaultStatus || "New",
        graphApiVersion: cfg.graphApiVersion || "v25.0",
        adSetName: cfg.adSetName || "",
        parentCampaignName: cfg.parentCampaignName || "",
        formId: cfg.formId || "",
        // Meta-side live status (auto-synced) — lets the UI show WHY a config is paused.
        pausedByMeta: cfg.pausedByMeta || false,
        metaActive: cfg.metaActive !== false,
        metaFormStatus: cfg.metaFormStatus || "",
        metaAdsetStatus: cfg.metaAdsetStatus || "",
        metaCampaignStatus: cfg.metaCampaignStatus || "",
        createdBy: cfg.createdBy ? (cfg.createdBy._id || cfg.createdBy) : null,
        createdByName: (cfg.createdBy && cfg.createdBy.name) ? cfg.createdBy.name : "",
        _configType: "meta",
      }));

      const googleLeadCounts = await Promise.allSettled(
        googleList.map((cfg) =>
          api.get(`/lead/by-campaign?campaign=${encodeURIComponent(cfg.campaignName)}`)
            .then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || []).length)
            .catch(() => cfg.leads ?? 0),
        ),
      );

      const shapedGoogleFixed = googleList.map((cfg, idx) => ({
        _id: cfg._id,
        _isGoogle: true,
        id: cfg._id,
        name: cfg.campaignName,
        channel: "Google",
        status: cfg.isActive ? "Active" : "Paused",
        sent: cfg.sent ?? 0,
        leads: googleLeadCounts[idx]?.status === "fulfilled" ? googleLeadCounts[idx].value : cfg.leads ?? 0,
        converted: cfg.converted ?? 0,
        cost: cfg.cost ?? 0,
        date: fmtDate(cfg.createdAt),
        createdAt: cfg.createdAt,
        color: GOOGLE_COLORS[idx % GOOGLE_COLORS.length],
        googleKey: cfg.googleKey,
        campaignId: cfg.campaignId || "",
        formId: cfg.formId || "",
        company: cfg.company,
        isActive: cfg.isActive,
        defaultStatus: cfg.defaultStatus || "New",
        impressions: cfg.impressions ?? 0,
        clicks: cfg.clicks ?? 0,
        createdBy: cfg.createdBy ? (cfg.createdBy._id || cfg.createdBy) : null,
        createdByName: (cfg.createdBy && cfg.createdBy.name) ? cfg.createdBy.name : "",
        _configType: "google",
      }));

      const websiteLeadCounts = await Promise.allSettled(
        websiteList.map((cfg) =>
          api.get(`/lead/by-campaign?campaign=${encodeURIComponent(cfg.sourceName)}`)
            .then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || []).length)
            .catch(() => 0),
        ),
      );

      const shapedWebsite = websiteList.map((cfg, idx) => ({
        _id: cfg._id,
        _isWebsite: true,
        id: cfg._id,
        name: cfg.sourceName,
        channel: "Website",
        status: cfg.isActive ? "Active" : "Paused",
        sent: 0,
        leads: websiteLeadCounts[idx]?.status === "fulfilled" ? websiteLeadCounts[idx].value : 0,
        converted: 0,
        cost: 0,
        date: fmtDate(cfg.createdAt),
        createdAt: cfg.createdAt,
        color: WEBSITE_COLORS[idx % WEBSITE_COLORS.length],
        webhookSecret: cfg.webhookSecret,
        pageUrl: cfg.pageUrl || "",
        company: cfg.company,
        isActive: cfg.isActive,
        defaultStatus: cfg.defaultStatus || "New",
        createdBy: cfg.createdBy ? (cfg.createdBy._id || cfg.createdBy) : null,
        createdByName: (cfg.createdBy && cfg.createdBy.name) ? cfg.createdBy.name : "",
        _configType: "website",
      }));

      setCampaigns([...shapedMeta, ...shapedGoogleFixed, ...shapedWebsite]);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setCampaigns([]);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_API_URL.replace("/api", "") 
    const socket = socketIO(SOCKET_URL, { transports: ["websocket", "polling"] });
    socket.on("new_website_lead", () => { fetchCampaigns(); });
    return () => { socket.disconnect(); };
  }, [fetchCampaigns]);

  const handleToggle = async (e, campaign) => {
    e.stopPropagation();
    try {
      const endpoint = campaign._isGoogle ? `/google-ads-config/${campaign._id}/toggle` : campaign._isWebsite ? `/website-config/${campaign._id}/toggle` : `/meta-config/${campaign._id}/toggle`;
      await api.patch(endpoint); fetchCampaigns();
    } catch (err) { console.error("Toggle failed:", err); }
  };

  const handleDelete = async (e, campaign) => {
    e.stopPropagation();
    if (!window.confirm(`Disconnect "${campaign.name}"? This cannot be undone.`)) return;
    try {
      const endpoint = campaign._isGoogle ? `/google-ads-config/${campaign._id}` : campaign._isWebsite ? `/website-config/${campaign._id}` : `/meta-config/${campaign._id}`;
      await api.delete(endpoint); fetchCampaigns();
    } catch (err) { console.error("Delete failed:", err); }
  };

  const filters = ["All", "Active", "Paused", "Meta", "Google", "Website"];
  const filtered = campaigns.filter((c) => {
    const matchFilter = filter === "All" || c.status === filter || c.channel === filter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // ── Group Meta campaigns by parentCampaignName ──────────────────────────────
  const groupedMeta = {};
  const ungrouped = [];
  filtered.forEach((c) => {
    if (c._isMeta && c.parentCampaignName && c.parentCampaignName !== c.name) {
      if (!groupedMeta[c.parentCampaignName]) groupedMeta[c.parentCampaignName] = [];
      groupedMeta[c.parentCampaignName].push({ ...c, _inGroup: true });
    } else {
      ungrouped.push(c);
    }
  });

  const groupPageIds = {};
  Object.entries(groupedMeta).forEach(([parentName, adSets]) => {
    const withPageId = adSets.find((c) => c.pageId);
    if (withPageId) groupPageIds[parentName] = withPageId.pageId;
  });

  const metaCount = campaigns.filter((c) => c._isMeta).length;
  const googleCount = campaigns.filter((c) => c._isGoogle).length;
  const websiteCount = campaigns.filter((c) => c._isWebsite).length;

  const cardProps = (c) => ({
    c,
    onSelect: setSelected,
    onEdit: setEditCampaign,
    onToggle: handleToggle,
    onDelete: handleDelete,
    onQualification: setQualificationAdSet,
    isSuperAdmin,
    adminList,
    onAssign: isSuperAdmin ? (c) => setAssigningCampaign({ c, selectedAdminId: "" }) : null,
  });

  const isEmpty = Object.keys(groupedMeta).length === 0 && ungrouped.length === 0;

  // ── Breadcrumb computation ──────────────────────────────────────────────────
  // Level 0 (null/null):       "Campaigns"
  // Level 1 (string/null):     "Campaigns > {parentName}"
  // Level 2 (string/object):   "Campaigns > {parentName} > {adSetName}"
  const breadcrumbs = selectedAdSet
    ? [
        { label: "Campaigns", onClick: () => { setSelectedParent(null); setSelectedAdSet(null); } },
        { label: selectedParent, onClick: () => setSelectedAdSet(null) },
        { label: selectedAdSet.adSetName || selectedAdSet.name, onClick: null },
      ]
    : selectedParent
    ? [
        { label: "Campaigns", onClick: () => setSelectedParent(null) },
        { label: selectedParent, onClick: null },
      ]
    : [{ label: "Campaigns", onClick: null }];

  // ── Assign ownership handler ────────────────────────────────────────────────
  const handleConfirmAssign = async () => {
    if (!assigningCampaign || !assigningCampaign.selectedAdminId) return;
    const { c, selectedAdminId } = assigningCampaign;
    const endpointMap = { meta: "/meta-config/claim-ownership", google: "/google-ads-config/claim-ownership", website: "/website-config/claim-ownership" };
    const endpoint = endpointMap[c._configType];
    if (!endpoint) return;
    setAssignLoading(true);
    try {
      await api.post(endpoint, { adminId: selectedAdminId, configId: c._id });
      setAssigningCampaign(null);
      fetchCampaigns();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to assign ownership.");
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <>
      {/* ── Assign Ownership Modal ────────────────────────────────────────────── */}
      {assigningCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setAssigningCampaign(null)}>
          <div className="bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Assign Campaign Owner</h3>
                <p className="text-[12px] text-[#8B92A9] mt-1 break-all">{assigningCampaign.c.name}</p>
              </div>
              <button onClick={() => setAssigningCampaign(null)} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white ml-2 shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] mb-4 leading-relaxed">
              This campaign will become visible <strong>only to the selected admin</strong>. Their team will be used for round-robin lead assignment.
            </p>
            <label className="block text-[11px] font-bold text-[#4B5168] dark:text-[#9DA3BB] uppercase tracking-wider mb-1.5">Select Admin</label>
            <select
              value={assigningCampaign.selectedAdminId}
              onChange={e => setAssigningCampaign(prev => ({ ...prev, selectedAdminId: e.target.value }))}
              className="w-full text-[13px] px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[#0F1117] dark:text-[#F0F2FA] mb-4"
            >
              <option value="">— Select an admin —</option>
              {adminList.map(a => (
                <option key={a._id} value={a._id}>{a.name}{a.email ? ` (${a.email})` : ""}</option>
              ))}
            </select>
            {adminList.length === 0 && (
              <p className="text-[11px] text-amber-600 mb-4">No admins found. Create an admin first.</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setAssigningCampaign(null)} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#8B92A9] hover:bg-[#F8F9FC] dark:hover:bg-white/5 transition">Cancel</button>
              <button
                onClick={handleConfirmAssign}
                disabled={!assigningCampaign.selectedAdminId || assignLoading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[13px] font-bold transition flex items-center justify-center gap-2"
              >
                {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Assign Owner
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-4 py-5 sm:px-6 sm:py-8 overflow-x-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 mb-1 flex-wrap">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <ChevronRight className="w-3 h-3 text-[#8B92A9]" />
                )}
                {crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    className="text-[13px] font-semibold text-[#2563EB] dark:text-[#4F8EF7] hover:underline"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={`text-[13px] font-semibold ${i === breadcrumbs.length - 1 ? "text-[#0F1117] dark:text-[#F0F2FA]" : "text-[#8B92A9]"}`}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>

          <h1 className="text-[20px] sm:text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            {selectedAdSet ? (selectedAdSet.adSetName || selectedAdSet.name) : selectedParent ? selectedParent : "Campaigns"}
          </h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            {pageLoading
              ? "Loading…"
              : selectedAdSet
              ? `Ads · ${selectedAdSet.leads ?? 0} lead${(selectedAdSet.leads ?? 0) !== 1 ? "s" : ""}`
              : selectedParent
              ? `${(groupedMeta[selectedParent] || []).length} ad set${(groupedMeta[selectedParent] || []).length !== 1 ? "s" : ""}`
              : `${metaCount} Meta · ${googleCount} Google Ads · ${websiteCount} Website`}
          </p>
        </div>

        {/* ── Action buttons — ONLY shown at root (Campaigns) level ──────── */}
        {!selectedParent && !selectedAdSet && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync Meta — only when Meta is already connected AND enabled */}
            {isMetaConnected && canMeta && (
              <button
                onClick={() => setSyncTarget({ pageId: "", parentName: "" })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E1306C]/40 bg-[#FFF0F3] dark:bg-[#2D0A14] text-[#E1306C] text-[13px] font-semibold hover:bg-pink-100 dark:hover:bg-pink-900/30 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Meta
              </button>
            )}

            {/* Connect Meta */}
            {canMeta ? (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
                Connect Meta
              </button>
            ) : (
              <div title="Meta Ads not enabled on your plan" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F1F4FF] dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#C4C9D9] dark:text-[#3E4257] text-[13px] font-semibold cursor-not-allowed select-none">
                <Lock className="w-3.5 h-3.5" />
                Meta Ads — Plan upgrade required
              </div>
            )}

            {/* Connect Google Ads */}
            {canGoogle ? (
              <button
                onClick={() => setShowCreateGoogle(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
                </svg>
                Connect Google Ads
              </button>
            ) : (
              <div title="Google Ads not enabled on your plan" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F1F4FF] dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#C4C9D9] dark:text-[#3E4257] text-[13px] font-semibold cursor-not-allowed select-none">
                <Lock className="w-3.5 h-3.5" />
                Google Ads — Plan upgrade required
              </div>
            )}

            {/* Connect Website */}
            {canWebsite ? (
              <button
                onClick={() => setShowCreateWebsite(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 transition"
              >
                <Globe className="w-4 h-4" />
                Connect Website
              </button>
            ) : (
              <div title="Website Tracking not enabled on your plan" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F1F4FF] dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#C4C9D9] dark:text-[#3E4257] text-[13px] font-semibold cursor-not-allowed select-none">
                <Lock className="w-3.5 h-3.5" />
                Website Tracking — Plan upgrade required
              </div>
            )}
          </div>
        )}

        {/* Back button — shown on Level 1 (Ad Sets) and Level 2 (Ads detail) */}
        {(selectedParent || selectedAdSet) && (
          <button
            onClick={() => {
              if (selectedAdSet) {
                setSelectedAdSet(null);
              } else {
                setSelectedParent(null);
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#E1306C] hover:text-[#E1306C] transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {selectedAdSet ? `Back to ${selectedParent}` : "Back to Campaigns"}
          </button>
        )}
      </div>

      {/* ── Filters + search — only shown at Campaigns root level ───────────── */}
      {!selectedParent && !selectedAdSet && (
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
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
            <button
              onClick={fetchCampaigns}
              className="w-8 h-8 shrink-0 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] transition"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pageLoading ? "animate-spin" : ""}`} />
            </button>
            <div className="relative flex-1 sm:flex-none min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" />
              <input
                type="text"
                placeholder="Search campaigns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-48 pl-8 pr-4 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Campaign cards area ─────────────────────────────────────────────── */}
      {pageLoading ? (
        <div className="flex items-center justify-center py-24 text-[#8B92A9] gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-[14px]">Loading campaigns…</span>
        </div>

      ) : selectedAdSet ? (
        // ── Level 2: Leads / Ads for a specific Ad Set ──────────────────────
        <div>
          {/* Ad set info bar */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38]">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                {selectedAdSet.adSetName || selectedAdSet.name}
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Ad Set · Parent: {selectedParent} · Page ID: <span className="font-mono">{selectedAdSet.pageId || "—"}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center">
                <div className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{selectedAdSet.leads ?? "—"}</div>
                <div className="text-[10px] text-[#8B92A9] uppercase tracking-wide">Leads</div>
              </div>
              <button
                onClick={() => setSelected(selectedAdSet)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-semibold hover:bg-[#dce7ff] transition"
              >
                View All Leads
              </button>
              <button
                onClick={() => setQualificationAdSet(selectedAdSet)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:border-[#E1306C] hover:text-[#E1306C] transition"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Qualification
              </button>
            </div>
          </div>

          {/* Inline leads list for this ad set */}
          <AdSetLeadsPanel adSet={selectedAdSet} />
        </div>

      ) : selectedParent ? (
        // ── Level 1: Ad Sets for selected parent campaign ──────────────────
        <div>
          {/* Campaign info bar */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38]">
            <div className="w-9 h-9 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{selectedParent}</h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {(groupedMeta[selectedParent] || []).length} ad set{(groupedMeta[selectedParent] || []).length !== 1 ? "s" : ""} ·
                Page ID: <span className="font-mono">{(groupedMeta[selectedParent] || [])[0]?.pageId || "—"}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center">
                <div className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                  {(groupedMeta[selectedParent] || []).reduce((s, c) => s + (c.leads || 0), 0).toLocaleString() || "—"}
                </div>
                <div className="text-[10px] text-[#8B92A9] uppercase tracking-wide">Total Leads</div>
              </div>
            </div>
          </div>

          {/* Ad Set rows — [ View Leads ] [ Edit ] [ Qualification ] */}
          <div className="space-y-3">
            {(groupedMeta[selectedParent] || []).map((adSet) => {
              const st = STATUS_STYLE[adSet.status] || STATUS_STYLE.Active;
              return (
                <div
                  key={adSet._id}
                  className="w-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.25)] transition-all"
                >
                  <div className="h-0.5 w-full" style={{ background: adSet.color }} />
                  <div className="px-5 py-4">
                    {/* Top row: icon + info + lead count */}
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center shrink-0">
                          <Lock className="w-4 h-4 text-[#E1306C]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.bg} ${st.text}`}>
                              {adSet.status}
                            </span>
                            {adSet.pausedByMeta && !adSet.isActive && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF1F2] dark:bg-[#3B0A12] text-[#E1306C] dark:text-[#F472B6]"
                                title={`Paused on Meta — ad set: ${adSet.metaAdsetStatus || "n/a"}, campaign: ${adSet.metaCampaignStatus || "n/a"}`}
                              >
                                Paused on Meta
                              </span>
                            )}
                          </div>
                          <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">
                            {adSet.adSetName || adSet.name}
                          </h3>
                          <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">{adSet.date}</p>
                        </div>
                      </div>
                      <div className="text-center shrink-0">
                        <div className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{fmt(adSet.leads)}</div>
                        <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 uppercase tracking-wide">Leads</div>
                      </div>
                    </div>

                    {/* Action buttons: [ View Leads ] [ Edit ] [ Qualification ] */}
                    <div className="flex items-center gap-2 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
                      {/* View Leads */}
                      <button
                        onClick={() => setSelectedAdSet(adSet)}
                        className="flex-1 py-2 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[12px] font-semibold hover:bg-[#dce7ff] dark:hover:bg-[#1e2d52] transition"
                      >
                        View Leads ({adSet.leads || 0})
                      </button>

                      {/* Edit */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditCampaign(adSet); }}
                        className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:border-[#E1306C] hover:text-[#E1306C] transition"
                        title="Edit ad set"
                      >
                        <EditIcon />
                      </button>

                      {/* Qualification */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setQualificationAdSet(adSet); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] hover:border-[#E1306C] hover:text-[#E1306C] transition"
                        title="Qualification rules"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Qualification
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        // ── Level 0: Campaigns root view ─────────────────────────────────────
        <div className="space-y-4">
          {/* Grouped Meta campaigns — each row is a parent campaign */}
          {Object.entries(groupedMeta).map(([parentName, adSets]) => {
            const totalLeads = adSets.reduce((sum, c) => sum + (c.leads || 0), 0);
            const activeCount = adSets.filter((c) => c.isActive).length;
            return (
              <button
                key={parentName}
                onClick={() => setSelectedParent(parentName)}
                className="w-full text-left bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:border-[#E1306C]/40 transition-all group"
              >
                <div className="h-1 w-full bg-[#E1306C]" />
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF0F3] dark:bg-[#2D0A14] text-[#E1306C]">Meta</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399]">
                          {activeCount}/{adSets.length} active
                        </span>
                      </div>
                      <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] truncate">{parentName}</h3>
                      <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                        {adSets.length} ad set{adSets.length !== 1 ? "s" : ""} · Page ID: <span className="font-mono">{adSets[0]?.pageId || "—"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <div className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                        {totalLeads > 0 ? totalLeads.toLocaleString() : "—"}
                      </div>
                      <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 uppercase tracking-wide">Total Leads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{adSets.length}</div>
                      <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-0.5 uppercase tracking-wide">Ad Sets</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-[#8B92A9] dark:text-[#565C75] group-hover:text-[#E1306C] transition">
                        View ad sets
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#8B92A9] dark:text-[#565C75] group-hover:text-[#E1306C] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {/* Ungrouped campaigns (Google, Website, standalone Meta) */}
          {ungrouped.length > 0 && (
            <>
              {Object.keys(groupedMeta).length > 0 && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest">Other campaigns</span>
                  <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ungrouped.map((c) => (
                  <CampaignCard key={c._id} {...cardProps(c)} />
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {Object.keys(groupedMeta).length === 0 && ungrouped.length === 0 && (
            <div className="text-center py-20 text-[#8B92A9] dark:text-[#565C75]">
              <div className="mb-3 flex justify-center text-[#8B92A9]"><Radio className="w-10 h-10" strokeWidth={1.5} /></div>
              <p className="text-[15px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">No campaigns connected</p>
              <p className="text-[13px] mt-1">Connect a Meta, Google Ads, or Website campaign to start receiving leads automatically.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Drawers / modals ─────────────────────────────────────────────────── */}
      {selected && <LeadDrawer campaign={selected} onClose={() => setSelected(null)} />}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchCampaigns} />}
      {showCreateGoogle && <CreateGoogleModal onClose={() => setShowCreateGoogle(false)} onCreated={fetchCampaigns} />}
      {showCreateWebsite && <CreateWebsiteModal onClose={() => setShowCreateWebsite(false)} onCreated={fetchCampaigns} />}
      {showEmailCampaign && <EmailCampaignModal campaigns={campaigns} onClose={() => setShowEmailCampaign(false)} />}
      {editCampaign && editCampaign._isMeta && <EditMetaModal campaign={editCampaign} onClose={() => setEditCampaign(null)} onUpdated={() => { setEditCampaign(null); fetchCampaigns(); }} />}
      {editCampaign && editCampaign._isGoogle && <EditGoogleModal campaign={editCampaign} onClose={() => setEditCampaign(null)} onUpdated={() => { setEditCampaign(null); fetchCampaigns(); }} />}
      {editCampaign && editCampaign._isWebsite && <EditWebsiteModal campaign={editCampaign} onClose={() => setEditCampaign(null)} onUpdated={() => { setEditCampaign(null); fetchCampaigns(); }} />}

      {/* ── Qualification Modal — Meta Ad Sets only ───────────────────────── */}
      {qualificationAdSet && (
        <QualificationModal
          adSet={qualificationAdSet}
          onClose={() => setQualificationAdSet(null)}
          onSaved={() => setQualificationAdSet(null)}
        />
      )}

      {/* ── Sync Meta modal ───────────────────────────────────────────────────
          BUG FIX: This modal is now triggered ONLY from the top-level Campaigns
          header "Sync Meta" button (which itself only renders when selectedParent
          === null AND isMetaConnected === true).
          Previously the only way to open the sync modal was from the ad-set
          drill-down header ("Sync ad sets" button), which meant the button was
          NEVER visible on the root Campaigns page.
          ──────────────────────────────────────────────────────────────────── */}
      {syncTarget !== null && (
        <SyncMetaModal
          prefillPageId={syncTarget.pageId}
          parentName={syncTarget.parentName || ""}
          onClose={() => setSyncTarget(null)}
          onSynced={() => { setSyncTarget(null); fetchCampaigns(); }}
        />
      )}
    </div>
    </>
  );
}
