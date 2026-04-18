import { useState, useEffect, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import VoiceBotPanel from "./VoiceBotPanel";
import { io as socketIO } from "socket.io-client";

// ── Channel / status style maps ───────────────────────────────────────────────
const CHANNEL_STYLE = {
  SMS: {
    bg: "bg-[#EEF3FF] dark:bg-[#1A2540]",
    text: "text-[#2563EB] dark:text-[#4F8EF7]",
  },
  WhatsApp: {
    bg: "bg-[#ECFDF5] dark:bg-[#052E1C]",
    text: "text-[#059669] dark:text-[#34D399]",
  },
  Email: {
    bg: "bg-[#F5F3FF] dark:bg-[#1E1040]",
    text: "text-[#7C3AED] dark:text-[#A78BFA]",
  },
  Meta: {
    bg: "bg-[#FFF0F3] dark:bg-[#2D0A14]",
    text: "text-[#E1306C] dark:text-[#F77FAD]",
  },
  Google: {
    bg: "bg-[#FFF8F0] dark:bg-[#2D1A00]",
    text: "text-[#EA4335] dark:text-[#FF6B5B]",
  },
  Website: {
    bg: "bg-[#F0FDF4] dark:bg-[#052E1C]",
    text: "text-[#16A34A] dark:text-[#4ADE80]",
  },
};

const STATUS_STYLE = {
  Active: {
    bg: "bg-[#ECFDF5] dark:bg-[#052E1C]",
    text: "text-[#059669] dark:text-[#34D399]",
    dot: "#059669",
  },
  Completed: {
    bg: "bg-[#EEF3FF] dark:bg-[#1A2540]",
    text: "text-[#2563EB] dark:text-[#4F8EF7]",
    dot: "#2563EB",
  },
  Paused: {
    bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]",
    text: "text-[#D97706] dark:text-[#FCD34D]",
    dot: "#D97706",
  },
  Draft: {
    bg: "bg-[#F1F5F9] dark:bg-[#1A1D27]",
    text: "text-[#8B92A9] dark:text-[#565C75]",
    dot: "#8B92A9",
  },
};

const LEAD_STATUS_STYLE = {
  Converted: {
    bg: "bg-[#ECFDF5] dark:bg-[#052E1C]",
    text: "text-[#059669] dark:text-[#34D399]",
  },
  "In Progress": {
    bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]",
    text: "text-[#D97706] dark:text-[#FCD34D]",
  },
  "Not Interested": {
    bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]",
    text: "text-[#DC2626] dark:text-[#F87171]",
  },
  New: {
    bg: "bg-[#EEF3FF] dark:bg-[#1A2540]",
    text: "text-[#2563EB] dark:text-[#4F8EF7]",
  },
};

const LEAD_TEMP_STYLE = {
  Hot: {
    bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]",
    text: "text-[#DC2626] dark:text-[#F87171]",
    icon: "🔥",
  },
  Warm: {
    bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]",
    text: "text-[#D97706] dark:text-[#FCD34D]",
    icon: "☀️",
  },
  Cold: {
    bg: "bg-[#EEF3FF] dark:bg-[#1A2540]",
    text: "text-[#2563EB] dark:text-[#4F8EF7]",
    icon: "❄️",
  },
};

const META_COLORS = [
  "#E1306C",
  "#2563EB",
  "#7C3AED",
  "#059669",
  "#D97706",
  "#0891B2",
];
const GOOGLE_COLORS = [
  "#EA4335",
  "#FBBC05",
  "#34A853",
  "#4285F4",
  "#FF6D00",
  "#46BDC6",
];
const WEBSITE_COLORS = [
  "#16A34A",
  "#0891B2",
  "#7C3AED",
  "#D97706",
  "#059669",
  "#2563EB",
];

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n != null && n > 0 ? Number(n).toLocaleString() : "—");
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Eye icons (shared) ────────────────────────────────────────────────────────
const EyeOn = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);
const EyeOff = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
);

// ── Edit icon ─────────────────────────────────────────────────────────────────
const EditIcon = () => (
  <svg
    className="w-3.5 h-3.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, color }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
        style={{ background: color + "20" }}
      >
        <div className="w-3 h-3 rounded-full" style={{ background: color }} />
      </div>
      <div className="text-[26px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
        {value}
      </div>
      <div className="text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mt-1">
        {label}
      </div>
      {sub && (
        <div className="text-[11px] text-[#059669] dark:text-[#34D399] mt-1 font-medium">
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Bulk Email Import Modal ───────────────────────────────────────────────────
function BulkEmailImportModal({ campaign, onClose }) {
  const [csvText, setCsvText] = useState(
    "mobile,email\n9876543210,rahul@gmail.com\n8765432109,priya@gmail.com",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleImport = async () => {
    setLoading(true);
    setError("");
    try {
      const lines = csvText.trim().split("\n").filter(Boolean);
      const header = lines[0]
        .toLowerCase()
        .split(",")
        .map((s) => s.trim());
      const mobileIdx = header.indexOf("mobile");
      const emailIdx = header.indexOf("email");
      if (mobileIdx === -1 || emailIdx === -1)
        return setError(
          "CSV must have 'mobile' and 'email' columns in the first row",
        );

      const updates = lines
        .slice(1)
        .map((line) => {
          const cols = line.split(",").map((s) => s.trim());
          return { mobile: cols[mobileIdx], email: cols[emailIdx] };
        })
        .filter((r) => r.mobile && r.email);

      if (updates.length === 0) return setError("No valid rows found in CSV");

      const res = await api.patch("/lead/admin/bulk-update-emails", {
        updates,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  if (result)
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-4">
            Emails Imported!
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#ECFDF5] dark:bg-[#052E1C] rounded-xl p-3">
              <div className="text-[22px] font-bold text-[#059669]">
                {result.matched}
              </div>
              <div className="text-[10px] text-[#8B92A9] uppercase">
                Updated
              </div>
            </div>
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] rounded-xl p-3">
              <div className="text-[22px] font-bold text-[#DC2626]">
                {result.notFound}
              </div>
              <div className="text-[10px] text-[#8B92A9] uppercase">
                Not found
              </div>
            </div>
          </div>
          {result.notFoundList?.length > 0 && (
            <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 text-left text-[11px] text-[#8B92A9] mb-4 max-h-24 overflow-y-auto">
              <p className="font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                Mobiles not found:
              </p>
              {result.notFoundList.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#2563EB]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Import Emails via CSV
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Match leads by mobile number and set their email
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
            <p className="font-semibold text-[#2563EB] mb-1">📋 CSV Format</p>
            <p>
              First row must be:{" "}
              <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono">
                mobile,email
              </code>
            </p>
            <p className="mt-0.5">
              Each following row:{" "}
              <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono">
                9876543210,rahul@gmail.com
              </code>
            </p>
            <p className="mt-0.5 text-[10px] text-[#8B92A9]">
              Leads are matched by mobile number. All leads with the same mobile
              will be updated.
            </p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
              Paste CSV data
            </label>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              className={FIELD_CLS + " font-mono text-[12px] resize-y"}
              placeholder={"mobile,email\n9876543210,rahul@gmail.com"}
            />
          </div>
          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626]">
              ⚠️ {error}
            </div>
          )}
        </div>
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Importing…
              </>
            ) : (
              "Import Emails"
            )}
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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editEmailId, setEditEmailId] = useState(null);
  const [editEmailVal, setEditEmailVal] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const fetchLeads = () => {
    if (!campaign) return;
    setLoading(true);
    if (campaign._isMeta || campaign._isGoogle || campaign._isWebsite) {
      api
        .get(`/lead/by-campaign?campaign=${encodeURIComponent(campaign.name)}`)
        .then((res) =>
          setLeads(Array.isArray(res.data) ? res.data : res.data?.data || []),
        )
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    } else {
      setLeads(campaign.leads_list || []);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [campaign]);

  const handleSaveEmail = async (leadId) => {
    if (!editEmailVal.trim()) return;
    setSavingEmail(true);
    try {
      await api.patch(`/lead/admin/update-email/${leadId}`, {
        email: editEmailVal.trim(),
      });
      setLeads((prev) =>
        prev.map((l) =>
          (l._id || l.id) === leadId ? { ...l, email: editEmailVal.trim() } : l,
        ),
      );
      setEditEmailId(null);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save email");
    } finally {
      setSavingEmail(false);
    }
  };

  if (!campaign) return null;

  const normalizedLeads = leads.map((l) => ({
    ...l,
    id: l._id || l.id,
    phone: l.mobile || l.phone,
  }));
  const channel = campaign.channel || "Meta";
  const ch = CHANNEL_STYLE[channel] || CHANNEL_STYLE.Meta;
  const st = STATUS_STYLE[campaign.status] || STATUS_STYLE.Active;
  const convRate =
    campaign.leads > 0
      ? Math.round((campaign.converted / campaign.leads) * 100)
      : 0;
  const leadsWithEmail = leads.filter(
    (l) => l.email && l.email.trim() !== "",
  ).length;
  const leadsWithoutEmail = leads.length - leadsWithEmail;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] h-full shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ch.bg} ${ch.text}`}
              >
                {channel}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}
              >
                {campaign.status}
              </span>
            </div>
            <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              {campaign.name}
            </h2>
            <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
              Created{" "}
              {campaign._isMeta || campaign._isGoogle || campaign._isWebsite
                ? fmtDate(campaign.createdAt)
                : campaign.date}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="px-6 py-4 grid grid-cols-3 gap-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          {[
            { label: "Sent", value: fmt(campaign.sent) },
            { label: "Leads", value: fmt(campaign.leads) },
            { label: "Conv. rate", value: convRate + "%" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-3 text-center"
            >
              <div className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                {s.value}
              </div>
              <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Email coverage bar */}
        <div className="px-6 py-3 border-b border-[#E4E7EF] dark:border-[#262A38]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
              Email coverage —{" "}
              <span className="text-[#7C3AED]">{leadsWithEmail}</span> of{" "}
              {leads.length} leads have email
            </span>
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] text-[11px] font-semibold hover:bg-[#dce7ff] transition"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Bulk Import Emails
            </button>
          </div>
          <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#7C3AED] transition-all"
              style={{
                width:
                  leads.length > 0
                    ? `${Math.round((leadsWithEmail / leads.length) * 100)}%`
                    : "0%",
              }}
            />
          </div>
          {leadsWithoutEmail > 0 && (
            <p className="text-[10px] text-[#D97706] mt-1">
              ⚠️ {leadsWithoutEmail} lead(s) missing email — add emails to
              include them in campaigns
            </p>
          )}
        </div>

        {/* Leads list */}
        <div className="px-6 py-4">
          <h3 className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-3">
            Leads from this campaign
            <span className="ml-2 text-[11px] font-medium text-[#8B92A9] dark:text-[#565C75]">
              {leads.length} shown
            </span>
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8B92A9] gap-2">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Loading leads…
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-10 text-[13px] text-[#8B92A9] dark:text-[#565C75]">
              No leads yet.
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((l, i) => {
                const name = l.name || "Unknown";
                const phone = l.phone || l.mobile || "—";
                const agent =
                  l.agent ||
                  (l.user && (l.user.name || "Assigned")) ||
                  "Unassigned";
                const status = l.status || "New";
                const remark = l.remark || "—";
                const temp = l.temperature || null;
                const ls =
                  LEAD_STATUS_STYLE[status] || LEAD_STATUS_STYLE["New"];
                const lt = temp ? LEAD_TEMP_STYLE[temp] || null : null;
                return (
                  <div
                    key={i}
                    className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-3 border border-[#E4E7EF] dark:border-[#262A38]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] shrink-0">
                          {name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                            {name}
                          </div>
                          <div className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                            {phone}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lt && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${lt.bg} ${lt.text}`}
                          >
                            {lt.icon} {temp}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${ls.bg} ${ls.text}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>

                    {/* Email row */}
                    {editEmailId === (l._id || l.id) ? (
                      <div className="flex items-center gap-1.5 mt-1.5 mb-1">
                        <input
                          type="email"
                          value={editEmailVal}
                          onChange={(e) => setEditEmailVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleSaveEmail(l._id || l.id);
                            if (e.key === "Escape") setEditEmailId(null);
                          }}
                          autoFocus
                          placeholder="email@example.com"
                          className="flex-1 px-2 py-1 rounded-lg border border-[#7C3AED] bg-white dark:bg-[#0D0F14] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEmail(l._id || l.id)}
                          disabled={savingEmail}
                          className="px-2 py-1 rounded-lg bg-[#7C3AED] text-white text-[11px] font-semibold hover:bg-purple-700 disabled:opacity-50"
                        >
                          {savingEmail ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditEmailId(null)}
                          className="px-2 py-1 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[11px] text-[#8B92A9]"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-1 mb-1">
                        {l.email && l.email.trim() ? (
                          <span className="flex items-center gap-1 text-[11px] text-[#059669] dark:text-[#34D399]">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            {l.email}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#D97706] italic">
                            No email
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditEmailId(l._id || l.id);
                            setEditEmailVal(l.email || "");
                          }}
                          className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[10px] font-semibold hover:bg-[#ede9fe] transition"
                        >
                          <svg
                            className="w-2.5 h-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          {l.email ? "Edit" : "+ Add Email"}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8B92A9] dark:text-[#565C75]">
                        Assigned:{" "}
                        <span className="text-[#4B5168] dark:text-[#9DA3BB] font-medium">
                          {agent}
                        </span>
                      </span>
                      <span className="text-[#8B92A9] dark:text-[#565C75] italic">
                        {remark}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Voice Bot panel */}
        <div className="px-6 pb-6">
          <VoiceBotPanel leads={normalizedLeads} campaignName={campaign.name} />
        </div>
      </div>

      {/* Bulk email import modal — rendered inside drawer overlay */}
      {showBulkImport && (
        <BulkEmailImportModal
          campaign={campaign.name}
          onClose={() => {
            setShowBulkImport(false);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
}

// ── Connect Meta Campaign modal ───────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const empty = {
    campaignName: "",
    pageId: "",
    pageAccessToken: "",
    appSecret: "",
    verifyToken: "",
    graphApiVersion: "v25.0",
    formIds: "",
    defaultStatus: "New",
    defaultRemark: "Lead from Meta Campaign",
  };

  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const required = [
    "campaignName",
    "pageId",
    "pageAccessToken",
    "appSecret",
    "verifyToken",
  ];
  const isValid = required.every((k) => form[k].trim() !== "");

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/meta-config", {
        campaignName: form.campaignName.trim(),
        pageId: form.pageId.trim(),
        pageAccessToken: form.pageAccessToken.trim(),
        formIds: form.formIds
          ? form.formIds
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        defaultStatus: form.defaultStatus || "New",
        defaultRemark: form.defaultRemark || "Lead from Meta Campaign",
        graphApiVersion: form.graphApiVersion.trim() || "v25.0",
        _meta: {
          META_APP_SECRET: form.appSecret.trim(),
          META_VERIFY_TOKEN: form.verifyToken.trim(),
          META_GRAPH_API_VERSION: form.graphApiVersion.trim(),
        },
      });
      setSuccess(true);
      onCreated && onCreated(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to connect campaign",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
            Campaign connected!
          </h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            Meta leads from{" "}
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {form.campaignName}
            </span>{" "}
            will now flow into your CRM automatically.
          </p>
          <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3 text-left text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5 space-y-1 border border-[#E4E7EF] dark:border-[#262A38]">
            <p className="font-semibold text-[#4B5168] dark:text-[#9DA3BB] text-[12px] mb-2">
              📋 Add these to your server{" "}
              <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded">
                .env
              </code>
            </p>
            <p>
              <span className="text-[#2563EB]">META_APP_SECRET</span>=
              {form.appSecret}
            </p>
            <p>
              <span className="text-[#2563EB]">META_VERIFY_TOKEN</span>=
              {form.verifyToken}
            </p>
            <p>
              <span className="text-[#2563EB]">META_GRAPH_API_VERSION</span>=
              {form.graphApiVersion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#E1306C]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Connect Meta Campaign
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Auto-import leads · Round-robin assigned to your team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Campaign Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Campaign Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.campaignName}
                  onChange={set("campaignName")}
                  placeholder="e.g. Summer Sale 2025"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={set("defaultStatus")}
                    className={FIELD_CLS}
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Remark
                  </label>
                  <input
                    type="text"
                    value={form.defaultRemark}
                    onChange={set("defaultRemark")}
                    placeholder="Lead from Meta Campaign"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Meta / Facebook Config
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Page ID <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.pageId}
                  onChange={set("pageId")}
                  placeholder="e.g. 123456789012345"
                  className={FIELD_CLS}
                />
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  Found in Facebook Page settings → About
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Page Access Token <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={form.pageAccessToken}
                    onChange={set("pageAccessToken")}
                    placeholder="EAAxxxxxx…"
                    className={FIELD_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                  >
                    {showToken ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  Generate a never-expiring token in Meta Business Suite →
                  System Users
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  App Secret <span className="text-[#DC2626]">*</span>{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (META_APP_SECRET)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={form.appSecret}
                    onChange={set("appSecret")}
                    placeholder="Your Meta app secret"
                    className={FIELD_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                  >
                    {showSecret ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Verify Token <span className="text-[#DC2626]">*</span>{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (META_VERIFY_TOKEN)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.verifyToken}
                    onChange={set("verifyToken")}
                    placeholder="skyup_meta_2025"
                    className={FIELD_CLS}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Graph API Version{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (META_GRAPH_API_VERSION)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.graphApiVersion}
                    onChange={set("graphApiVersion")}
                    placeholder="v25.0"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Form IDs{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (optional — blank = accept all)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.formIds}
                  onChange={set("formIds")}
                  placeholder="form_id_1, form_id_2"
                  className={FIELD_CLS}
                />
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  Comma-separated. Find in Meta Ads Manager → Lead forms
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
            <svg
              className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">
                Round-robin auto-assignment
              </p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                Every new lead from this campaign will be automatically assigned
                to the next available team member in rotation.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Connecting…
              </>
            ) : (
              "Connect & Start Receiving Leads"
            )}
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
    defaultStatus: campaign.defaultStatus || "New",
    defaultRemark: campaign.defaultRemark || "Lead from Meta Campaign",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.campaignName.trim() || !form.pageId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        campaignName: form.campaignName.trim(),
        pageId: form.pageId.trim(),
        formIds: form.formIds
          ? form.formIds
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        defaultStatus: form.defaultStatus || "New",
        defaultRemark: form.defaultRemark || "Lead from Meta Campaign",
        graphApiVersion: form.graphApiVersion.trim() || "v25.0",
      };
      if (form.pageAccessToken.trim())
        payload.pageAccessToken = form.pageAccessToken.trim();
      if (form.appSecret.trim()) payload.appSecret = form.appSecret.trim();
      if (form.verifyToken.trim())
        payload.verifyToken = form.verifyToken.trim();

      await api.put(`/meta-config/${campaign._id}`, payload);
      setSuccess(true);
      onUpdated && onUpdated();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update campaign",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
            Campaign updated!
          </h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {form.campaignName}
            </span>{" "}
            has been updated successfully.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF0F3] dark:bg-[#2D0A14] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#E1306C]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Edit Meta Campaign
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {campaign.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Campaign Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Campaign Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.campaignName}
                  onChange={set("campaignName")}
                  placeholder="e.g. Summer Sale 2025"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={set("defaultStatus")}
                    className={FIELD_CLS}
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Remark
                  </label>
                  <input
                    type="text"
                    value={form.defaultRemark}
                    onChange={set("defaultRemark")}
                    placeholder="Lead from Meta Campaign"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Meta / Facebook Config
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Page ID <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.pageId}
                  onChange={set("pageId")}
                  placeholder="e.g. 123456789012345"
                  className={FIELD_CLS}
                />
              </div>
              <div className="bg-[#FFFBEB] dark:bg-[#2D1F00] rounded-xl px-4 py-3 flex gap-3 border border-[#FCD34D]/30">
                <svg
                  className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                  Leave token / secret fields blank to keep existing values.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  New Page Access Token{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (leave blank to keep current)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={form.pageAccessToken}
                    onChange={set("pageAccessToken")}
                    placeholder="EAAxxxxxx…"
                    className={FIELD_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                  >
                    {showToken ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  New App Secret{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (leave blank to keep current)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={form.appSecret}
                    onChange={set("appSecret")}
                    placeholder="Only if changing app secret"
                    className={FIELD_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                  >
                    {showSecret ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    New Verify Token{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.verifyToken}
                    onChange={set("verifyToken")}
                    placeholder="Leave blank to keep"
                    className={FIELD_CLS}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Graph API Version
                  </label>
                  <input
                    type="text"
                    value={form.graphApiVersion}
                    onChange={set("graphApiVersion")}
                    placeholder="v25.0"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Form IDs{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (blank = accept all forms)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.formIds}
                  onChange={set("formIds")}
                  placeholder="form_id_1, form_id_2"
                  className={FIELD_CLS}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !form.campaignName.trim() || !form.pageId.trim() || loading
            }
            className="flex-1 py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
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
    defaultRemark: campaign.defaultRemark || "Lead from Google Ads",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.campaignName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        campaignName: form.campaignName.trim(),
        campaignId: form.campaignId.trim(),
        formId: form.formId.trim(),
        defaultStatus: form.defaultStatus || "New",
        defaultRemark: form.defaultRemark || "Lead from Google Ads",
      };
      if (form.googleKey.trim()) payload.googleKey = form.googleKey.trim();

      await api.put(`/google-ads-config/${campaign._id}`, payload);
      setSuccess(true);
      onUpdated && onUpdated();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update campaign",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
            Campaign updated!
          </h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {form.campaignName}
            </span>{" "}
            has been updated successfully.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF8F0] dark:bg-[#2D1A00] flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Edit Google Ads Campaign
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {campaign.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Campaign Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Campaign Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.campaignName}
                  onChange={set("campaignName")}
                  placeholder="e.g. Google Search — Branding Q2"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={set("defaultStatus")}
                    className={FIELD_CLS}
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Remark
                  </label>
                  <input
                    type="text"
                    value={form.defaultRemark}
                    onChange={set("defaultRemark")}
                    placeholder="Lead from Google Ads"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Google Ads Config
            </p>
            <div className="space-y-3">
              <div className="bg-[#FFFBEB] dark:bg-[#2D1F00] rounded-xl px-4 py-3 flex gap-3 border border-[#FCD34D]/30">
                <svg
                  className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                  Leave the Webhook Key blank to keep your existing key. Only
                  fill it in to rotate credentials.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  New Webhook Key{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (leave blank to keep current)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={form.googleKey}
                    onChange={set("googleKey")}
                    placeholder="Only if rotating key…"
                    className={FIELD_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                  >
                    {showKey ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Campaign ID{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.campaignId}
                    onChange={set("campaignId")}
                    placeholder="e.g. 1234567890"
                    className={FIELD_CLS}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Form ID{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.formId}
                    onChange={set("formId")}
                    placeholder="e.g. 9876543210"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.campaignName.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connect Google Ads Campaign modal ─────────────────────────────────────────
function CreateGoogleModal({ onClose, onCreated }) {
  const empty = {
    campaignName: "",
    googleKey: "",
    campaignId: "",
    formId: "",
    defaultStatus: "New",
    defaultRemark: "Lead from Google Ads",
  };

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
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/google-ads-config", {
        campaignName: form.campaignName.trim(),
        googleKey: form.googleKey.trim(),
        campaignId: form.campaignId.trim(),
        formId: form.formId.trim(),
        defaultStatus: form.defaultStatus || "New",
        defaultRemark: form.defaultRemark || "Lead from Google Ads",
      });
      setSuccess(true);
      onCreated && onCreated(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to connect campaign",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
            Google Ads connected!
          </h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            Leads from{" "}
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {form.campaignName}
            </span>{" "}
            will now flow into your CRM automatically via round-robin
            assignment.
          </p>
          <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3 text-left text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5 space-y-2 border border-[#E4E7EF] dark:border-[#262A38]">
            <p className="font-semibold text-[#4B5168] dark:text-[#9DA3BB] text-[12px] mb-1">
              📋 Add this webhook in Google Ads
            </p>
            <p className="text-[10px]">
              Go to:{" "}
              <span className="font-medium text-[#4B5168] dark:text-[#9DA3BB]">
                Google Ads → Lead Form → Lead delivery → Webhook
              </span>
            </p>
            <div className="bg-white dark:bg-[#0D0F14] rounded-lg px-3 py-2 border border-[#E4E7EF] dark:border-[#262A38] space-y-1">
              <p>
                <span className="text-[#EA4335]">Webhook URL</span> →
                your-server.com/google-webhook
              </p>
              <p>
                <span className="text-[#EA4335]">Key</span> →{" "}
                <span className="font-mono">{form.googleKey}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#FFF8F0] dark:bg-[#2D1A00] flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Connect Google Ads Campaign
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Auto-import leads · Round-robin assigned to your team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Campaign Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Campaign Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.campaignName}
                  onChange={set("campaignName")}
                  placeholder="e.g. Google Search — Branding Q2"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={set("defaultStatus")}
                    className={FIELD_CLS}
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Remark
                  </label>
                  <input
                    type="text"
                    value={form.defaultRemark}
                    onChange={set("defaultRemark")}
                    placeholder="Lead from Google Ads"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Google Ads Config
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Webhook Key <span className="text-[#DC2626]">*</span>
                  <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">
                    (set this as the Key in Google Ads)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={form.googleKey}
                    onChange={set("googleKey")}
                    placeholder="e.g. skyup_google_2025"
                    className={FIELD_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                  >
                    {showKey ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  Create any secret string. Paste this exact value in Google Ads
                  → Lead Form → Lead delivery → Webhook → Key.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Campaign ID{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.campaignId}
                    onChange={set("campaignId")}
                    placeholder="e.g. 1234567890"
                    className={FIELD_CLS}
                  />
                  <p className="text-[10px] text-[#8B92A9] mt-1">
                    Filter leads by campaign. Blank = accept all.
                  </p>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Form ID{" "}
                    <span className="text-[10px] font-normal text-[#8B92A9]">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={form.formId}
                    onChange={set("formId")}
                    placeholder="e.g. 9876543210"
                    className={FIELD_CLS}
                  />
                  <p className="text-[10px] text-[#8B92A9] mt-1">
                    Filter leads by lead form. Blank = accept all.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFF8F0] dark:bg-[#2D1A00] rounded-xl px-4 py-3 flex gap-3 border border-[#FBBF7A]/30">
            <svg
              className="w-4 h-4 text-[#EA4335] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-[#EA4335]">
                Webhook URL to enter in Google Ads
              </p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                After saving, go to{" "}
                <span className="font-medium">
                  Google Ads → Lead Form → Lead delivery → Webhook
                </span>{" "}
                and enter:
              </p>
              <p className="text-[11px] font-mono bg-white dark:bg-[#0D0F14] rounded px-2 py-1 mt-1.5 border border-[#E4E7EF] dark:border-[#262A38] text-[#EA4335] break-all">
                https://your-server.com/google-webhook
              </p>
            </div>
          </div>

          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
            <svg
              className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">
                Round-robin auto-assignment
              </p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                Every new Google lead will be automatically assigned to the next
                available team member in rotation.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Connecting…
              </>
            ) : (
              "Connect & Start Receiving Leads"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Connect Website modal ─────────────────────────────────────────────────────
function CreateWebsiteModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    sourceName: "",
    webhookSecret: "",
    pageUrl: "",
    defaultStatus: "New",
    defaultRemark: "Lead from Website",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const isValid =
    form.sourceName.trim() !== "" && form.webhookSecret.trim() !== "";

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/website-config", {
        sourceName: form.sourceName.trim(),
        webhookSecret: form.webhookSecret.trim(),
        pageUrl: form.pageUrl.trim(),
        defaultStatus: form.defaultStatus || "New",
        defaultRemark: form.defaultRemark || "Lead from Website",
      });
      setSuccess(true);
      onCreated && onCreated(res.data.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to connect website",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const webhookUrl = "https://skyup-crm-backend.onrender.com/website-webhook";
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
  .then(function(r){ console.log("CRM: lead sent ✅", r.status); })
  .catch(function(e){ console.warn("CRM: fetch failed", e); });
})();
<\/script>`;

    const dataLayerSnippet = `// Call this inside your form's onSubmit AFTER a successful API call
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  event:        "crm_lead",
  form_name:    formData.name,       // required
  form_mobile:  formData.mobile,     // required
  form_email:   formData.email,      // optional
  form_message: formData.message,    // optional
  form_source:  "${sourceName}",     // label for this form
});`;

    const CopyBtn = ({ text }) => {
      const [copied, setCopied] = useState(false);
      return (
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 ${copied ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] hover:bg-[#dce7ff]"}`}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      );
    };

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[#059669]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                  <span className="text-[#16A34A]">{sourceName}</span>{" "}
                  connected!
                </h2>
                <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                  Follow the 3 steps below to start receiving leads
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-5 space-y-4">
            {/* Step 1 — GTM Tag */}
            <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                <span className="w-6 h-6 rounded-full bg-[#2563EB] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                    Create GTM Tag
                  </p>
                  <p className="text-[10px] text-[#8B92A9]">
                    In GTM → Tags → New → Custom HTML → paste this script
                  </p>
                </div>
                <CopyBtn text={gtmScript} />
              </div>
              <pre className="px-4 py-3 text-[10px] font-mono text-[#059669] dark:text-[#4ADE80] bg-[#0D1117] dark:bg-[#080A10] overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                {gtmScript}
              </pre>
            </div>

            {/* Step 2 — GTM Trigger */}
            <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E]">
                <span className="w-6 h-6 rounded-full bg-[#7C3AED] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                    Set GTM Trigger
                  </p>
                  <p className="text-[10px] text-[#8B92A9]">
                    In GTM → Triggering → New Trigger → set these exact values
                  </p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2 border-t border-[#E4E7EF] dark:border-[#262A38]">
                {[
                  { label: "Trigger Type", value: "Custom Event" },
                  { label: "Event Name", value: "crm_lead", mono: true },
                  { label: "Fires on", value: "All Custom Events" },
                ].map(({ label, value, mono }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75] w-28 shrink-0">
                      {label}
                    </span>
                    <div className="flex items-center gap-2 flex-1">
                      <span
                        className={`flex-1 px-2.5 py-1.5 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] ${mono ? "font-mono text-[#7C3AED]" : ""}`}
                      >
                        {value}
                      </span>
                      {mono && <CopyBtn text={value} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 — React dataLayer push */}
            <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                <span className="w-6 h-6 rounded-full bg-[#D97706] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                    Add to your React form's{" "}
                    <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] px-1 rounded text-[10px]">
                      onSubmit
                    </code>
                  </p>
                  <p className="text-[10px] text-[#8B92A9]">
                    Add this code AFTER your successful API call — for every
                    form on your site
                  </p>
                </div>
                <CopyBtn text={dataLayerSnippet} />
              </div>
              <pre className="px-4 py-3 text-[10px] font-mono text-[#F6A044] dark:text-[#FCD34D] bg-[#0D1117] dark:bg-[#080A10] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {dataLayerSnippet}
              </pre>
            </div>

            {/* Info box */}
            <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
              <svg
                className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] space-y-1">
                <p>
                  <span className="font-semibold text-[#2563EB]">
                    Both Contact Page + Enquiry Popup
                  </span>{" "}
                  use the same GTM tag and trigger.
                </p>
                <p>
                  Change{" "}
                  <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono text-[#7C3AED]">
                    form_source
                  </code>{" "}
                  to{" "}
                  <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono">
                    "Contact Page"
                  </code>{" "}
                  or{" "}
                  <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono">
                    "Enquiry Popup"
                  </code>{" "}
                  in each form's push so you know where the lead came from in
                  the CRM remark.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 transition"
            >
              Done — Start receiving leads
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] dark:bg-[#052E1C] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#16A34A]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Connect Website Contact Form
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Auto-import leads · Round-robin assigned to your team
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Source Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Source Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.sourceName}
                  onChange={set("sourceName")}
                  placeholder="e.g. Contact Page, Homepage Form"
                  className={FIELD_CLS}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Contact Page URL{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.pageUrl}
                  onChange={set("pageUrl")}
                  placeholder="e.g. https://yourwebsite.com/contact"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={set("defaultStatus")}
                    className={FIELD_CLS}
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Remark
                  </label>
                  <input
                    type="text"
                    value={form.defaultRemark}
                    onChange={set("defaultRemark")}
                    placeholder="Lead from Website"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Webhook Config
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                Webhook Secret <span className="text-[#DC2626]">*</span>
                <span className="ml-1 text-[10px] font-normal text-[#8B92A9]">
                  (sent with every form submission)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={form.webhookSecret}
                  onChange={set("webhookSecret")}
                  placeholder="e.g. skyup_website_2025"
                  className={FIELD_CLS + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                >
                  {showSecret ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
              <p className="text-[10px] text-[#8B92A9] mt-1">
                Create any secret string. Your website will include this in
                every POST to verify the source.
              </p>
            </div>
          </div>

          <div className="bg-[#F0FDF4] dark:bg-[#052E1C] rounded-xl px-4 py-3 flex gap-3 border border-[#BBF7D0]/40">
            <svg
              className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-[#16A34A]">
                Webhook URL for your website
              </p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                POST to this URL from your contact form's submit handler:
              </p>
              <p className="text-[11px] font-mono bg-white dark:bg-[#0D0F14] rounded px-2 py-1 mt-1.5 border border-[#E4E7EF] dark:border-[#262A38] text-[#16A34A] break-all">
                https://your-server.com/website-webhook
              </p>
              <p className="text-[10px] text-[#8B92A9] mt-1.5">
                Required:{" "}
                <span className="font-mono">webhook_secret, name, mobile</span>{" "}
                · Optional: <span className="font-mono">email, message</span>
              </p>
            </div>
          </div>

          <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 flex gap-3">
            <svg
              className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <div>
              <p className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">
                Round-robin auto-assignment
              </p>
              <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5">
                Every new website lead will be automatically assigned to the
                next available team member in rotation.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Connecting…
              </>
            ) : (
              "Connect & Start Receiving Leads"
            )}
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
    defaultRemark: campaign.defaultRemark || "Lead from Website",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.sourceName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const payload = {
        sourceName: form.sourceName.trim(),
        pageUrl: form.pageUrl.trim(),
        defaultStatus: form.defaultStatus || "New",
        defaultRemark: form.defaultRemark || "Lead from Website",
      };
      if (form.webhookSecret.trim())
        payload.webhookSecret = form.webhookSecret.trim();
      await api.put(`/website-config/${campaign._id}`, payload);
      setSuccess(true);
      onUpdated && onUpdated();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to update",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success)
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
            Website source updated!
          </h2>
          <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75] mb-6">
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {form.sourceName}
            </span>{" "}
            has been updated successfully.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] dark:bg-[#052E1C] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#16A34A]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Edit Website Source
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                {campaign.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Source Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Source Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={form.sourceName}
                  onChange={set("sourceName")}
                  placeholder="e.g. Contact Page"
                  className={FIELD_CLS}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Contact Page URL{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={form.pageUrl}
                  onChange={set("pageUrl")}
                  placeholder="e.g. https://yourwebsite.com/contact"
                  className={FIELD_CLS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Status
                  </label>
                  <select
                    value={form.defaultStatus}
                    onChange={set("defaultStatus")}
                    className={FIELD_CLS}
                  >
                    <option>New</option>
                    <option>In Progress</option>
                    <option>Converted</option>
                    <option>Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Default Remark
                  </label>
                  <input
                    type="text"
                    value={form.defaultRemark}
                    onChange={set("defaultRemark")}
                    placeholder="Lead from Website"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Webhook Config
            </p>
            <div className="bg-[#FFFBEB] dark:bg-[#2D1F00] rounded-xl px-4 py-3 flex gap-3 border border-[#FCD34D]/30 mb-3">
              <svg
                className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                Leave the Webhook Secret blank to keep your existing secret.
                Only fill it in to rotate credentials.
              </p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                New Webhook Secret{" "}
                <span className="text-[10px] font-normal text-[#8B92A9]">
                  (leave blank to keep current)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={form.webhookSecret}
                  onChange={set("webhookSecret")}
                  placeholder="Only if rotating secret…"
                  className={FIELD_CLS + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]"
                >
                  {showSecret ? <EyeOff /> : <EyeOn />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.sourceName.trim() || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Email Campaign Modal ──────────────────────────────────────────────────────
function EmailCampaignModal({ campaigns, onClose }) {
  const [mode, setMode] = useState("campaign"); // "campaign" | "single" | "csv"

  // ── Campaign mode state ──
  const [form, setForm] = useState({
    campaign: "",
    subject: "",
    fromName: "",
    bodyTemplate:
      "<p>Hi {{name}},</p>\n<p>We are reaching out about our <strong>{{campaign}}</strong> campaign.</p>\n<p>Please feel free to contact us at any time.</p>\n<p>Regards,<br/>The Team</p>",
  });
  const [leadCount, setLeadCount] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  // ── Single lead mode state ──
  const [singleLead, setSingleLead] = useState({ name: "", email: "" });

  // ── CSV mode state ──
  const [csvText, setCsvText] = useState(
    "name,email\nRahul Sharma,rahul@gmail.com\nPriya Patel,priya@gmail.com",
  );
  const [csvParsed, setCsvParsed] = useState(null);
  const [csvError, setCsvError] = useState("");

  // ── Shared state ──
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState(
    "<p>Hi {{name}},</p>\n<p>We are reaching out about our <strong>{{campaign}}</strong> campaign.</p>\n<p>Please feel free to contact us at any time.</p>\n<p>Regards,<br/>The Team</p>",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const campaignNames = [
    ...new Set(campaigns.map((c) => c.name).filter(Boolean)),
  ];
  const MERGE_TAGS = ["{{name}}", "{{campaign}}", "{{mobile}}", "{{email}}"];

  // ── CSV parse ──
  const parseCSV = () => {
    setCsvError("");
    const lines = csvText.trim().split("\n").filter(Boolean);
    if (lines.length < 2)
      return setCsvError("Need at least a header row and one data row");
    const header = lines[0]
      .toLowerCase()
      .split(",")
      .map((s) => s.trim());
    const nameIdx = header.indexOf("name");
    const emailIdx = header.indexOf("email");
    if (emailIdx === -1) return setCsvError("CSV must have an 'email' column");
    const rows = lines
      .slice(1)
      .map((line) => {
        const cols = line.split(",").map((s) => s.trim());
        return {
          name: nameIdx !== -1 ? cols[nameIdx] : "Friend",
          email: cols[emailIdx],
        };
      })
      .filter((r) => r.email && r.email.includes("@"));
    if (rows.length === 0) return setCsvError("No valid email rows found");
    setCsvParsed(rows);
  };

  // ── Campaign preview ──
  const handlePreview = async () => {
    if (!form.campaign) return;
    setPreviewing(true);
    setLeadCount(null);
    try {
      const res = await api.get(
        `/email-campaign/preview?campaign=${encodeURIComponent(form.campaign)}`,
      );
      setLeadCount(res.data.leadCount);
    } catch (err) {
      setError(err.response?.data?.message || "Could not fetch preview");
    } finally {
      setPreviewing(false);
    }
  };

  // ── Send ──
  const handleSend = async () => {
    if (!subject || !bodyTemplate)
      return setError("Subject and body are required");
    setLoading(true);
    setError("");
    try {
      let res;
      if (mode === "campaign") {
        if (!form.campaign) return setError("Select a campaign");
        let count = leadCount;
        if (count === null) {
          setPreviewing(true);
          const r = await api.get(
            `/email-campaign/preview?campaign=${encodeURIComponent(form.campaign)}`,
          );
          count = r.data.leadCount;
          setLeadCount(count);
          setPreviewing(false);
        }
        if (
          !window.confirm(
            `Send emails to ${count} leads in "${form.campaign}"?`,
          )
        ) {
          setLoading(false);
          return;
        }
        res = await api.post("/email-campaign/send", {
          campaign: form.campaign,
          subject,
          bodyTemplate,
          fromName: fromName || undefined,
        });
      } else if (mode === "single") {
        if (!singleLead.email || !singleLead.name)
          return setError("Name and email are required");
        if (
          !window.confirm(
            `Send email to ${singleLead.name} (${singleLead.email})?`,
          )
        ) {
          setLoading(false);
          return;
        }
        res = await api.post("/email-campaign/send-single", {
          name: singleLead.name,
          email: singleLead.email,
          subject,
          bodyTemplate,
          fromName: fromName || undefined,
        });
      } else {
        if (!csvParsed) return setError("Parse the CSV first");
        if (
          !window.confirm(
            `Send emails to ${csvParsed.length} recipients from CSV?`,
          )
        ) {
          setLoading(false);
          return;
        }
        res = await api.post("/email-campaign/send-csv", {
          recipients: csvParsed,
          subject,
          bodyTemplate,
          fromName: fromName || undefined,
        });
      }
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const insertTag = (tag) => setBodyTemplate((p) => p + tag);

  // ── Result screen ──
  if (result)
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-[#059669]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">
            Campaign Sent!
          </h2>
          <div className="grid grid-cols-3 gap-3 my-5">
            {[
              { label: "Sent", value: result.sent ?? 1, color: "#059669" },
              { label: "Failed", value: result.failed ?? 0, color: "#DC2626" },
              { label: "Total", value: result.total ?? 1, color: "#2563EB" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-3 text-center border border-[#E4E7EF] dark:border-[#262A38]"
              >
                <div
                  className="text-[22px] font-bold"
                  style={{ color: s.color }}
                >
                  {s.value}
                </div>
                <div className="text-[10px] text-[#8B92A9] uppercase tracking-wide mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {result.errors?.length > 0 && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] rounded-xl px-4 py-3 text-left text-[11px] text-[#DC2626] mb-4 max-h-28 overflow-y-auto">
              {result.errors.slice(0, 5).map((e, i) => (
                <div key={i}>
                  {e.email}: {e.error}
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    );

  const isValid =
    subject.trim() &&
    bodyTemplate.trim() &&
    (mode === "campaign"
      ? !!form.campaign
      : mode === "single"
        ? !!singleLead.email && !!singleLead.name
        : !!csvParsed);

  const recipientLabel =
    mode === "campaign" && leadCount !== null
      ? `${leadCount} leads`
      : mode === "single" && singleLead.email
        ? "1 recipient"
        : mode === "csv" && csvParsed
          ? `${csvParsed.length} recipients`
          : "recipients";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1A1D27] rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F5F3FF] dark:bg-[#1E1040] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[#7C3AED]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                Send Email Campaign
              </h2>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                Personalized bulk emails via Brevo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-6 pt-5 pb-0 shrink-0">
          <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-2">
            Send to
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                key: "campaign",
                label: "Campaign leads",
                icon: (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"
                    />
                  </svg>
                ),
              },
              {
                key: "single",
                label: "Single lead",
                icon: (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                ),
              },
              {
                key: "csv",
                label: "CSV import",
                icon: (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                ),
              },
            ].map((m) => (
              <button
                key={m.key}
                onClick={() => {
                  setMode(m.key);
                  setError("");
                }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition ${
                  mode === m.key
                    ? "border-[#7C3AED] bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED]"
                    : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#7C3AED]/50"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* ── Campaign mode ── */}
          {mode === "campaign" && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
                Target campaign
              </p>
              <div className="flex gap-2">
                <select
                  value={form.campaign}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, campaign: e.target.value }));
                    setLeadCount(null);
                  }}
                  className={FIELD_CLS + " flex-1"}
                >
                  <option value="">— Select a campaign —</option>
                  {campaignNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handlePreview}
                  disabled={!form.campaign || previewing}
                  className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#7C3AED] hover:border-[#7C3AED] disabled:opacity-40 transition flex items-center gap-1.5 shrink-0"
                >
                  {previewing ? (
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                  Preview
                </button>
              </div>
              {leadCount !== null && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px]">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                  <span className="text-[#7C3AED] font-semibold">
                    {leadCount} leads
                  </span>
                  <span className="text-[#8B92A9]">
                    with email addresses will receive this campaign
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Single lead mode ── */}
          {mode === "single" && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
                Recipient details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Full name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={singleLead.name}
                    onChange={(e) =>
                      setSingleLead((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Rahul Sharma"
                    className={FIELD_CLS}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                    Email address <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="email"
                    value={singleLead.email}
                    onChange={(e) =>
                      setSingleLead((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="rahul@gmail.com"
                    className={FIELD_CLS}
                  />
                </div>
              </div>
              {singleLead.name && singleLead.email && (
                <div className="mt-2 flex items-center gap-2 text-[12px] bg-[#F5F3FF] dark:bg-[#1E1040] rounded-xl px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-[#7C3AED] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {singleLead.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="font-semibold text-[#7C3AED]">
                    {singleLead.name}
                  </span>
                  <span className="text-[#8B92A9]">·</span>
                  <span className="text-[#4B5168] dark:text-[#9DA3BB]">
                    {singleLead.email}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── CSV mode ── */}
          {mode === "csv" && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
                CSV recipients
              </p>
             <div className="bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl px-4 py-3 text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mb-3">
                <p className="font-semibold text-[#2563EB] mb-1">
                  📋 CSV Format
                </p>
                <p>
                  First row:{" "}
                  <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono">
                    name,email
                  </code>
                </p>
                <p className="mt-0.5">
                  Each row:{" "}
                  <code className="bg-white dark:bg-[#0D0F14] px-1 rounded font-mono">
                    Rahul Sharma,rahul@gmail.com
                  </code>
                </p>
              </div>

              {/* ── File upload button ── */}
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 mb-3 rounded-xl border-2 border-dashed border-[#7C3AED]/40 bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[12px] font-semibold cursor-pointer hover:border-[#7C3AED] hover:bg-[#ede9fe] dark:hover:bg-[#2a1a5e] transition">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                Upload CSV file
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setCsvText(ev.target.result);
                      setCsvParsed(null);
                      setCsvError("");
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
              </label>

              {/* ── Divider ── */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
                <span className="text-[10px] text-[#8B92A9] font-medium">or paste below</span>
                <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]" />
              </div>

              <textarea
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setCsvParsed(null);
                  setCsvError("");
                }}
                rows={6}
                className={FIELD_CLS + " font-mono text-[12px] resize-y"}
                placeholder={"name,email\nRahul Sharma,rahul@gmail.com"}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={parseCSV}
                  className="px-4 py-2 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] text-[12px] font-semibold hover:bg-[#dce7ff] transition flex items-center gap-1.5"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Parse CSV
                </button>
                {csvParsed && (
                  <span className="flex items-center gap-1.5 text-[12px] text-[#059669] font-semibold">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {csvParsed.length} valid recipients found
                  </span>
                )}
              </div>
              {csvError && (
                <p className="text-[11px] text-[#DC2626] mt-1.5">
                  ⚠️ {csvError}
                </p>
              )}
              {csvParsed && csvParsed.length > 0 && (
                <div className="mt-3 border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                  {csvParsed.slice(0, 8).map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2 text-[11px] ${i % 2 === 0 ? "bg-[#F8F9FC] dark:bg-[#13161E]" : "bg-white dark:bg-[#0D0F14]"}`}
                    >
                      <span className="text-[#8B92A9] w-4 text-right shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium text-[#0F1117] dark:text-[#F0F2FA] w-32 truncate shrink-0">
                        {r.name}
                      </span>
                      <span className="text-[#7C3AED]">{r.email}</span>
                    </div>
                  ))}
                  {csvParsed.length > 8 && (
                    <div className="px-3 py-2 text-[11px] text-[#8B92A9] bg-[#F8F9FC] dark:bg-[#13161E] text-center">
                      +{csvParsed.length - 8} more recipients
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Shared: email details ── */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Email details
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  Subject line <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Special offer just for you, {{name}}!"
                  className={FIELD_CLS}
                />
                <p className="text-[10px] text-[#8B92A9] mt-1">
                  You can use{" "}
                  <code className="bg-[#EEF3FF] dark:bg-[#1A2540] text-[#7C3AED] px-1 rounded">
                    {"{{name}}"}
                  </code>{" "}
                  in the subject too.
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
                  From name{" "}
                  <span className="text-[10px] font-normal text-[#8B92A9]">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="e.g. SkyUp CRM Team"
                  className={FIELD_CLS}
                />
              </div>
            </div>
          </div>

          {/* ── Merge tags ── */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-2">
              Available merge tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => insertTag(tag)}
                  className="px-2.5 py-1 rounded-lg bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[11px] font-mono font-semibold hover:bg-[#ede9fe] transition"
                >
                  {tag}
                </button>
              ))}
              <span className="text-[10px] text-[#8B92A9] self-center ml-1">
                Click to insert
              </span>
            </div>
          </div>

          {/* ── Body ── */}
          <div>
            <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-3">
              Email body (HTML) <span className="text-[#DC2626]">*</span>
            </p>
            <textarea
              value={bodyTemplate}
              onChange={(e) => setBodyTemplate(e.target.value)}
              rows={10}
              placeholder="<p>Hi {{name}}, ...</p>"
              className={FIELD_CLS + " font-mono text-[12px] resize-y"}
            />
          </div>

          {/* ── Preview ── */}
          {bodyTemplate && (
            <div>
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest mb-2">
                Preview (sample data)
              </p>
              <div
                className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-4 bg-white dark:bg-[#0D0F14] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] max-h-48 overflow-y-auto"
                dangerouslySetInnerHTML={{
                  __html: bodyTemplate
                    .replace(/{{name}}/g, "<strong>Rahul Sharma</strong>")
                    .replace(/{{campaign}}/g, form.campaign || "Summer Sale")
                    .replace(/{{mobile}}/g, "9876543210")
                    .replace(/{{email}}/g, "rahul@example.com"),
                }}
              />
            </div>
          )}

          {/* ── Brevo info ── */}
          <div className="bg-[#F5F3FF] dark:bg-[#1E1040] rounded-xl px-4 py-3 flex gap-3 border border-[#7C3AED]/20">
            <svg
              className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
              Sent via Brevo API. Ensure{" "}
              <code className="bg-white dark:bg-[#0D0F14] px-1 rounded">
                BREVO_API_KEY
              </code>{" "}
              and{" "}
              <code className="bg-white dark:bg-[#0D0F14] px-1 rounded">
                BREVO_SENDER_EMAIL
              </code>{" "}
              are in your backend{" "}
              <code className="bg-white dark:bg-[#0D0F14] px-1 rounded">
                .env
              </code>
              .
            </p>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl px-4 py-3 text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!isValid || loading}
            className="flex-1 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Sending…
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Send to {recipientLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateGoogle, setShowCreateGoogle] = useState(false);
  const [showCreateWebsite, setShowCreateWebsite] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [showEmailCampaign, setShowEmailCampaign] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const fetchCampaigns = useCallback(async () => {
    setPageLoading(true);
    try {
      const [metaRes, googleRes, websiteRes] = await Promise.allSettled([
        api.get("/meta-config"),
        api.get("/google-ads-config"),
        api.get("/website-config"),
      ]);

      const metaList =
        metaRes.status === "fulfilled"
          ? Array.isArray(metaRes.value.data)
            ? metaRes.value.data
            : metaRes.value.data?.data || []
          : [];

      const googleList =
        googleRes.status === "fulfilled"
          ? Array.isArray(googleRes.value.data)
            ? googleRes.value.data
            : googleRes.value.data?.data || []
          : [];

      const websiteList =
        websiteRes.status === "fulfilled"
          ? websiteRes.value?.data?.data || []
          : [];

      const shapedMeta = metaList.map((cfg, idx) => ({
        _id: cfg._id,
        _isMeta: true,
        id: cfg._id,
        name: cfg.campaignName,
        channel: "Meta",
        status: cfg.isActive ? "Active" : "Paused",
        sent: cfg.sent ?? 0,
        leads: cfg.leads ?? 0,
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
        defaultRemark: cfg.defaultRemark || "Lead from Meta Campaign",
        graphApiVersion: cfg.graphApiVersion || "v25.0",
      }));

      const shapedGoogle = googleList.map((cfg, idx) => ({
        _id: cfg._id,
        _isGoogle: true,
        id: cfg._id,
        name: cfg.campaignName,
        channel: "Google",
        status: cfg.isActive ? "Active" : "Paused",
        sent: cfg.sent ?? 0,
        leads: cfg.leads ?? 0,
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
        defaultRemark: cfg.defaultRemark || "Lead from Google Ads",
      }));

      // Fetch real lead counts for each website campaign
      const websiteLeadCounts = await Promise.allSettled(
        websiteList.map((cfg) =>
          api
            .get(
              `/lead/by-campaign?campaign=${encodeURIComponent(cfg.sourceName)}`,
            )
            .then(
              (r) =>
                (Array.isArray(r.data) ? r.data : r.data?.data || []).length,
            )
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
        leads:
          websiteLeadCounts[idx]?.status === "fulfilled"
            ? websiteLeadCounts[idx].value
            : 0,
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
        defaultRemark: cfg.defaultRemark || "Lead from Website",
      }));

      setCampaigns([...shapedMeta, ...shapedGoogle, ...shapedWebsite]);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setCampaigns([]);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // ── Real-time: listen for new website leads via socket ───────────────────────
  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace("/api", "")
      : "http://localhost:5000";

    const socket = socketIO(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("new_website_lead", () => {
      // Refresh campaigns so lead count & drawer update automatically
      fetchCampaigns();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchCampaigns]);

  const handleToggle = async (e, campaign) => {
    e.stopPropagation();
    try {
      const endpoint = campaign._isGoogle
        ? `/google-ads-config/${campaign._id}/toggle`
        : campaign._isWebsite
          ? `/website-config/${campaign._id}/toggle`
          : `/meta-config/${campaign._id}/toggle`;
      await api.patch(endpoint);
      fetchCampaigns();
    } catch (err) {
      console.error("Toggle failed:", err);
    }
  };

  const handleDelete = async (e, campaign) => {
    e.stopPropagation();
    if (
      !window.confirm(`Disconnect "${campaign.name}"? This cannot be undone.`)
    )
      return;
    try {
      const endpoint = campaign._isGoogle
        ? `/google-ads-config/${campaign._id}`
        : campaign._isWebsite
          ? `/website-config/${campaign._id}`
          : `/meta-config/${campaign._id}`;
      await api.delete(endpoint);
      fetchCampaigns();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const filters = ["All", "Active", "Paused", "Meta", "Google", "Website"];

  const filtered = campaigns.filter((c) => {
    const matchFilter =
      filter === "All" || c.status === filter || c.channel === filter;
    const matchSearch =
      !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalLeads = campaigns.reduce((s, c) => s + (c.leads || 0), 0);
  const totalConverted = campaigns.reduce((s, c) => s + (c.converted || 0), 0);
  const totalSent = campaigns.reduce((s, c) => s + (c.sent || 0), 0);
  const overallCPL =
    totalLeads > 0
      ? Math.round(
          campaigns.reduce((s, c) => s + (c.cost || 0), 0) / totalLeads,
        )
      : 0;

  const metaCount = campaigns.filter((c) => c._isMeta).length;
  const googleCount = campaigns.filter((c) => c._isGoogle).length;
  const websiteCount = campaigns.filter((c) => c._isWebsite).length;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen font-poppins px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            Campaigns
          </h1>
          {/* FIX 1 & 2: removed stray JSX expression; now correctly shows all three counts */}
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            {pageLoading
              ? "Loading…"
              : `${metaCount} Meta · ${googleCount} Google Ads · ${websiteCount} Website`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmailCampaign(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-purple-700 transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Email Campaign
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E1306C] text-white text-[13px] font-semibold hover:bg-[#c4185a] transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
            </svg>
            Connect Meta
          </button>
          <button
            onClick={() => setShowCreateGoogle(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA4335] text-white text-[13px] font-semibold hover:bg-red-600 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#fff"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#fff"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#fff"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#fff"
              />
            </svg>
            Connect Google Ads
          </button>
          <button
            onClick={() => setShowCreateWebsite(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16A34A] text-white text-[13px] font-semibold hover:bg-green-700 transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            Connect Website
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total sent"
          value={totalSent.toLocaleString()}
          color="#2563EB"
          sub="Across all campaigns"
        />
        <SummaryCard
          label="Leads generated"
          value={totalLeads.toLocaleString()}
          color="#7C3AED"
          sub="From all campaigns"
        />
        <SummaryCard
          label="Conversions"
          value={totalConverted.toLocaleString()}
          color="#059669"
          sub={
            totalLeads > 0
              ? `${Math.round((totalConverted / totalLeads) * 100)}% conv. rate`
              : ""
          }
        />
        <SummaryCard
          label="Avg. cost/lead"
          value={`₹${overallCPL}`}
          color="#D97706"
          sub="Across all spend"
        />
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${filter === f ? "bg-[#2563EB] text-white" : "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCampaigns}
            className="w-8 h-8 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] hover:border-[#2563EB] transition"
            title="Refresh"
          >
            <svg
              className={`w-3.5 h-3.5 ${pageLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
              />
            </svg>
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
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-[14px]">Loading campaigns…</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const st = STATUS_STYLE[c.status] || STATUS_STYLE.Active;
            const ch = CHANNEL_STYLE[c.channel] || CHANNEL_STYLE.Meta;
            const convRate =
              c.leads > 0 ? Math.round((c.converted / c.leads) * 100) : 0;
            const cpl = c.leads > 0 ? Math.round(c.cost / c.leads) : 0;

            // FIX 4: edit hover colour now accounts for all three channel types
            const editHoverCls = c._isMeta
              ? "hover:border-[#E1306C] hover:text-[#E1306C]"
              : c._isWebsite
                ? "hover:border-[#16A34A] hover:text-[#16A34A]"
                : "hover:border-[#EA4335] hover:text-[#EA4335]";

            return (
              <div
                key={c._id}
                className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-shadow"
              >
                <div className="h-1 w-full" style={{ background: c.color }} />

                <div className="p-5">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ch.bg} ${ch.text}`}
                        >
                          {c.channel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${st.bg} ${st.text}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: st.dot }}
                          />
                          {c.status}
                        </span>
                      </div>
                      <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-snug truncate">
                        {c.name}
                      </h3>
                      <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
                        {c.date}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                      { label: "Sent", value: fmt(c.sent) },
                      { label: "Leads", value: fmt(c.leads) },
                      {
                        label: "Conv.",
                        value: c.converted > 0 ? c.converted : "—",
                      },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-2 py-2.5 text-center"
                      >
                        <div className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                          {s.value}
                        </div>
                        <div className="text-[9px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conv rate bar */}
                  {c.leads > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">
                          Conv. rate
                        </span>
                        <span className="text-[11px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                          {convRate}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${convRate}%`, background: c.color }}
                        />
                      </div>
                      {c.cost > 0 && (
                        <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-1">
                          ₹{cpl} cost per lead · ₹{c.cost.toLocaleString()}{" "}
                          total spend
                        </p>
                      )}
                    </div>
                  )}

                  {/* FIX 3: Source badge handles all three channel types correctly */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <svg
                      className="w-3 h-3 text-[#2563EB] dark:text-[#4F8EF7] shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">
                      Round-robin ·{" "}
                      {c._isMeta
                        ? "Page ID: "
                        : c._isWebsite
                          ? "Source: "
                          : "Key: "}
                      <span className="font-mono">
                        {c._isMeta
                          ? c.pageId
                          : c._isWebsite
                            ? c.pageUrl || "Webhook"
                            : c.googleKey
                              ? "••••••"
                              : "—"}
                      </span>
                    </span>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditCampaign(c);
                      }}
                      className={`px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#8B92A9] transition ${editHoverCls}`}
                      title="Edit campaign"
                    >
                      <EditIcon />
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
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
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
              <p className="text-[15px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
                No campaigns connected
              </p>
              <p className="text-[13px] mt-1">
                Connect a Meta, Google Ads, or Website campaign to start
                receiving leads automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Drawers / modals */}
      {selected && (
        <LeadDrawer campaign={selected} onClose={() => setSelected(null)} />
      )}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchCampaigns}
        />
      )}
      {showCreateGoogle && (
        <CreateGoogleModal
          onClose={() => setShowCreateGoogle(false)}
          onCreated={fetchCampaigns}
        />
      )}
      {showCreateWebsite && (
        <CreateWebsiteModal
          onClose={() => setShowCreateWebsite(false)}
          onCreated={fetchCampaigns}
        />
      )}
      {showEmailCampaign && (
        <EmailCampaignModal
          campaigns={campaigns}
          onClose={() => setShowEmailCampaign(false)}
        />
      )}

      {editCampaign && editCampaign._isMeta && (
        <EditMetaModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onUpdated={() => {
            setEditCampaign(null);
            fetchCampaigns();
          }}
        />
      )}
      {editCampaign && editCampaign._isGoogle && (
        <EditGoogleModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onUpdated={() => {
            setEditCampaign(null);
            fetchCampaigns();
          }}
        />
      )}
      {editCampaign && editCampaign._isWebsite && (
        <EditWebsiteModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onUpdated={() => {
            setEditCampaign(null);
            fetchCampaigns();
          }}
        />
      )}
    </div>
  );
}
