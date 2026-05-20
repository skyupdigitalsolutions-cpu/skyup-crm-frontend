// components/SuperAdminFilter.jsx
// Super Admin can pick any admin → see their users, leads, and phone-reveal stats.
import { useState, useEffect, useCallback } from "react";
import {
  Users, BarChart2, Eye, ChevronDown, X, Phone, TrendingUp,
  UserCheck, FileText, Loader, AlertCircle, ArrowLeft, Search,
} from "lucide-react";
import api from "../data/axiosConfig";

// ── helpers ───────────────────────────────────────────────────────────────────
function Badge({ children, color = "blue" }) {
  const map = {
    blue:   "bg-blue-50   dark:bg-blue-500/10   text-blue-700   dark:text-blue-300",
    green:  "bg-green-50  dark:bg-green-500/10  text-green-700  dark:text-green-300",
    red:    "bg-red-50    dark:bg-red-500/10    text-red-700    dark:text-red-300",
    amber:  "bg-amber-50  dark:bg-amber-500/10  text-amber-700  dark:text-amber-300",
    purple: "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300",
    gray:   "bg-gray-100  dark:bg-gray-700/40   text-gray-600   dark:text-gray-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[color] || map.gray}`}>
      {children}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color = "blue" }) {
  const iconColors = {
    blue:   "text-blue-500",
    green:  "text-green-500",
    purple: "text-purple-500",
    amber:  "text-amber-500",
  };
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3 flex items-center gap-3">
      <Icon className={`w-5 h-5 shrink-0 ${iconColors[color] || iconColors.blue}`} />
      <div>
        <div className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums leading-none">{value}</div>
        <div className="text-[10px] text-[#6B7280] dark:text-[#565C75] mt-0.5">{label}</div>
      </div>
    </div>
  );
}

const STATUS_COLOR = {
  "New":           "blue",
  "In Progress":   "amber",
  "Converted":     "green",
  "Not Interested":"red",
};
const TEMP_COLOR = { Hot: "red", Warm: "amber", Cold: "blue", Unknown: "gray" };

// ── Phone Reveals sub-panel ───────────────────────────────────────────────────
function PhoneRevealPanel({ reveals }) {
  const [search, setSearch] = useState("");
  const filtered = reveals.filter(
    (r) => r.name?.toLowerCase().includes(search.toLowerCase()) || r.mobile?.includes(search)
  );
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-3.5 h-3.5 text-[#6B7280]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lead name or phone…"
          className="flex-1 text-[12px] bg-transparent outline-none text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#9CA3AF]"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] py-4 text-center">No phone reveals found.</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {filtered.map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{r.name}</p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#565C75] mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {r.mobile}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <div className="text-[13px] font-bold text-purple-600 dark:text-purple-400 tabular-nums">{r.revealCount}×</div>
                <div className="text-[9px] text-[#9CA3AF]">reveals</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Leads sub-panel ───────────────────────────────────────────────────────────
function LeadsPanel({ leads }) {
  const [search, setSearch] = useState("");
  const filtered = leads.filter(
    (l) =>
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.mobile?.includes(search) ||
      l.status?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 border border-[#E5E7EB] dark:border-[#262A38] rounded-lg px-3 py-1.5">
        <Search className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="flex-1 text-[12px] bg-transparent outline-none text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#9CA3AF]"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] py-4 text-center">No leads found.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {filtered.map((l) => (
            <div key={l._id} className="flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg px-3 py-2.5 gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{l.name}</p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#565C75] truncate">{l.source} · {l.campaign || "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge color={STATUS_COLOR[l.status] || "gray"}>{l.status}</Badge>
                {l.temperature && <Badge color={TEMP_COLOR[l.temperature] || "gray"}>{l.temperature}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Users sub-panel ───────────────────────────────────────────────────────────
function UsersPanel({ users }) {
  return users.length === 0 ? (
    <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] py-4 text-center">No users assigned to this admin.</p>
  ) : (
    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
      {users.map((u) => (
        <div key={u._id} className="flex items-center gap-3 bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg px-3 py-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: "#2563EB" }}
          >
            {u.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{u.name}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#565C75] truncate">{u.email}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab-bar for detail view ───────────────────────────────────────────────────
const TABS = [
  { key: "leads",   label: "Leads",         Icon: FileText },
  { key: "users",   label: "Users",         Icon: UserCheck },
  { key: "reveals", label: "Phone Reveals", Icon: Eye },
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function SuperAdminFilter() {
  const [admins,        setAdmins]        = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [adminsError,   setAdminsError]   = useState(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);

  const [details,        setDetails]        = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError,   setDetailsError]   = useState(null);

  const [activeTab, setActiveTab] = useState("leads");

  // ── Load admin list on mount ─────────────────────────────────────────────
  const loadAdmins = useCallback(() => {
    setLoadingAdmins(true);
    setAdminsError(null);
    api.get("/superadmin/admins")
      .then((r) => setAdmins(r.data || []))
      .catch((e) => setAdminsError(e.response?.data?.message || "Failed to load admins"))
      .finally(() => setLoadingAdmins(false));
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  // ── Load details when admin selected ────────────────────────────────────
  const loadDetails = useCallback((adminId) => {
    setLoadingDetails(true);
    setDetailsError(null);
    setDetails(null);
    api.get(`/superadmin/admins/${adminId}`)
      .then((r) => setDetails(r.data))
      .catch((e) => setDetailsError(e.response?.data?.message || "Failed to load admin details"))
      .finally(() => setLoadingDetails(false));
  }, []);

  const handleSelectAdmin = (admin) => {
    setSelectedAdmin(admin);
    setDropdownOpen(false);
    setActiveTab("leads");
    loadDetails(admin._id);
  };

  const handleClear = () => {
    setSelectedAdmin(null);
    setDetails(null);
    setDetailsError(null);
    setActiveTab("leads");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl p-4 sm:p-5 mt-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[13px] sm:text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
            Admin-Based Filter
          </h2>
          <p className="text-[11px] text-[#6B7280] dark:text-[#565C75] mt-0.5">
            Select an admin to see their users, leads, and phone-reveal activity
          </p>
        </div>
        {selectedAdmin && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-[11px] text-[#6B7280] hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Admin dropdown ── */}
      <div className="relative mb-4">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          disabled={loadingAdmins}
          className="w-full flex items-center justify-between gap-2 border border-[#E5E7EB] dark:border-[#262A38]
            bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-3 py-2.5
            text-[12px] text-[#0F1117] dark:text-[#F0F2FA] hover:border-blue-400 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#6B7280] shrink-0" />
            {loadingAdmins ? (
              <span className="text-[#9CA3AF]">Loading admins…</span>
            ) : selectedAdmin ? (
              <span className="font-medium">{selectedAdmin.name}</span>
            ) : (
              <span className="text-[#9CA3AF]">Select an admin…</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && !loadingAdmins && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1D27]
            border border-[#E5E7EB] dark:border-[#262A38] rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {adminsError ? (
              <p className="text-[12px] text-red-500 px-4 py-3">{adminsError}</p>
            ) : admins.length === 0 ? (
              <p className="text-[12px] text-[#6B7280] px-4 py-3">No admins found.</p>
            ) : (
              admins.map((a) => (
                <button
                  key={a._id}
                  onClick={() => handleSelectAdmin(a)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#F8F9FC]
                    dark:hover:bg-[#13161E] transition-colors text-left
                    ${selectedAdmin?._id === a._id ? "bg-blue-50 dark:bg-blue-500/10" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {a.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-[#0F1117] dark:text-[#F0F2FA] truncate">{a.name}</p>
                      <p className="text-[10px] text-[#6B7280] dark:text-[#565C75] truncate">{a.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-2">
                    <Badge color="blue">{a.userCount} users</Badge>
                    <Badge color="green">{a.leadCount} leads</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Loading / error / empty states ── */}
      {!selectedAdmin && !loadingAdmins && (
        <div className="flex flex-col items-center justify-center py-10 text-[#9CA3AF]">
          <BarChart2 className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-[12px]">Choose an admin above to drill down into their data.</p>
        </div>
      )}

      {loadingDetails && (
        <div className="flex items-center justify-center py-10 gap-2 text-[#6B7280]">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Loading admin data…</span>
        </div>
      )}

      {detailsError && !loadingDetails && (
        <div className="flex items-center gap-2 text-red-500 py-6 justify-center">
          <AlertCircle className="w-4 h-4" />
          <span className="text-[12px]">{detailsError}</span>
        </div>
      )}

      {/* ── Detail view ── */}
      {details && !loadingDetails && (
        <div>
          {/* Admin info banner */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl border border-[#E5E7EB] dark:border-[#262A38]">
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-[14px] font-bold text-white shrink-0">
              {details.admin.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{details.admin.name}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#565C75] truncate">{details.admin.email}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard icon={Users}     label="Users"         value={details.stats.totalUsers}                          color="blue"   />
            <StatCard icon={FileText}  label="Leads"         value={details.stats.totalLeads}                          color="green"  />
            <StatCard icon={TrendingUp} label="Converted"    value={details.stats.statusBreakdown?.Converted || 0}     color="amber"  />
            <StatCard icon={Eye}       label="Phone Reveals" value={details.stats.phoneReveals.totalRevealsByAdmin}    color="purple" />
          </div>

          {/* Status / temp breakdown */}
          {details.stats.totalLeads > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Status */}
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] mb-2 uppercase tracking-wide">By Status</p>
                <div className="space-y-1.5">
                  {Object.entries(details.stats.statusBreakdown).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <Badge color={STATUS_COLOR[k] || "gray"}>{k}</Badge>
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Temperature */}
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl px-4 py-3">
                <p className="text-[11px] font-semibold text-[#6B7280] dark:text-[#565C75] mb-2 uppercase tracking-wide">By Temperature</p>
                <div className="space-y-1.5">
                  {Object.entries(details.stats.tempBreakdown).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <Badge color={TEMP_COLOR[k] || "gray"}>{k}</Badge>
                      <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] tabular-nums">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-[#E5E7EB] dark:border-[#262A38]">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors -mb-px
                  ${activeTab === key
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#6B7280] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                  ${activeTab === key ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300" : "bg-[#F3F4F6] dark:bg-[#262A38] text-[#6B7280]"}`}>
                  {key === "leads"   ? details.leads.length
                   : key === "users"   ? details.users.length
                   : details.stats.phoneReveals.leadsRevealed}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "leads"   && <LeadsPanel   leads={details.leads} />}
          {activeTab === "users"   && <UsersPanel   users={details.users} />}
          {activeTab === "reveals" && <PhoneRevealPanel reveals={details.stats.phoneReveals.details} />}
        </div>
      )}
    </div>
  );
}
