import { useState } from "react";

const PLANS = {
  base: { label: "Base", maxAdmins: 1,  maxUsers: 10, price: "₹999/mo",   badgeColor: "bg-slate-500",  borderColor: "border-slate-500",  bgColor: "bg-slate-50   dark:bg-slate-900/30", textColor: "text-slate-700 dark:text-slate-300",  statColor: "text-slate-600 dark:text-slate-400",  dividerColor: "bg-slate-300 dark:bg-slate-700" },
  next: { label: "Next", maxAdmins: 3,  maxUsers: 30, price: "₹2,499/mo", badgeColor: "bg-blue-600",   borderColor: "border-blue-500",   bgColor: "bg-blue-50    dark:bg-blue-950/40",   textColor: "text-blue-800  dark:text-blue-200",   statColor: "text-blue-600  dark:text-blue-400",   dividerColor: "bg-blue-300  dark:bg-blue-700"  },
  pro:  { label: "Pro",  maxAdmins: 5,  maxUsers: 50, price: "₹4,999/mo", badgeColor: "bg-violet-600", borderColor: "border-violet-500", bgColor: "bg-violet-50  dark:bg-violet-950/40", textColor: "text-violet-800 dark:text-violet-200", statColor: "text-violet-600 dark:text-violet-400", dividerColor: "bg-violet-300 dark:bg-violet-700" },
};

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function usernameFromName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ".");
}

const DEFAULT_ADMIN = {
  id: 0,
  name: "Super Admin",
  email: "admin@company.com",
  phone: "",
  role: "admin",
  username: "super.admin",
  password: "••••••••••",
  isDefault: true,
  addedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
};

const AVATAR_HEX = ["#2563EB","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#0F766E","#9333EA"];
function avatarHex(id) { return AVATAR_HEX[Math.abs(id) % AVATAR_HEX.length]; }

// ── Credentials Modal ─────────────────────────────────────────────────────────
function CredentialsModal({ member, onClose }) {
  const [copied, setCopied] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Account Created</h2>
          <p className="text-xs text-[#8B92A9] dark:text-[#565C75] mt-1 text-center">
            Credentials sent to <span className="font-semibold text-blue-600 dark:text-blue-400">{member.email}</span>
          </p>
        </div>
        <div className="space-y-3 mb-5">
          {[
            { label: "Username (Login)", value: member.username, key: "user" },
            { label: "Password",         value: member.password, key: "pass" },
          ].map(({ label, value, key }) => (
            <div key={key} className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1">{label}</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold text-[#0F1117] dark:text-[#F0F2FA] break-all">{value}</code>
                <button
                  onClick={() => copy(value, key)}
                  className="shrink-0 w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-blue-600 hover:border-blue-400 transition"
                >
                  {copied === key ? (
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] text-center mb-4">
          ⚠️ Share these credentials securely. Password can be reset later.
        </p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition">
          Done
        </button>
      </div>
    </div>
  );
}

// ── Add Member Modal ──────────────────────────────────────────────────────────
function AddMemberModal({ role, onClose, onAdd }) {
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const isAdmin = role === "admin";

  const handleAdd = () => {
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim() || !email.includes("@")) return setError("Valid email is required.");
    setError("");
    onAdd({
      id: Date.now(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      username: usernameFromName(name),
      password: generatePassword(),
      isDefault: false,
      addedOn: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isAdmin ? "bg-blue-50 dark:bg-blue-950/40" : "bg-green-50 dark:bg-green-950/40"}`}>
              {isAdmin ? (
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              )}
            </div>
            <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              Add {isAdmin ? "Admin" : "User (Agent)"}
            </h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {name.trim() && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
            <svg className="w-3.5 h-3.5 text-[#8B92A9] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">Login username:</span>
            <code className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400">{usernameFromName(name)}</code>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            {error}
          </p>
        )}

        <div className="space-y-3">
          {[
            { label: "Full name *", value: name,  set: setName,  placeholder: "e.g. Priya Sharma", type: "text"  },
            { label: "Email *",     value: email, set: setEmail, placeholder: "email@example.com", type: "email" },
            { label: "Phone",       value: phone, set: setPhone, placeholder: "Mobile (optional)", type: "tel"   },
          ].map(f => (
            <div key={f.label} className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] dark:placeholder:text-[#565C75] focus:outline-none focus:border-[#2563EB] transition"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            A secure password will be auto-generated and sent to the provided email.
          </p>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-xs font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className={`flex-1 py-2 rounded-xl text-white text-xs font-semibold transition ${isAdmin ? "bg-[#2563EB] hover:bg-blue-700" : "bg-[#059669] hover:bg-emerald-700"}`}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slot bar ──────────────────────────────────────────────────────────────────
function SlotBar({ used, max, isAdmin }) {
  const pct = Math.min(Math.round((used / max) * 100), 100);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="w-28 h-1.5 bg-[#E4E7EF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isAdmin ? "bg-[#2563EB]" : "bg-[#059669]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{used}/{max} slots</span>
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────
function MemberRow({ member, onRemove, onViewCreds }) {
  const initials = member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] last:border-0 group">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ background: avatarHex(member.id) }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{member.name}</p>
          {member.isDefault && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">Default</span>
          )}
        </div>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate">
          <code className="font-mono">{member.username}</code> · {member.email}
        </p>
      </div>
      {!member.isDefault && (
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={() => onViewCreds(member)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-blue-400 hover:text-blue-600 text-[#8B92A9] transition"
            title="View credentials"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </button>
          <button
            onClick={() => onRemove(member.id)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-red-400 hover:text-red-500 text-[#8B92A9] transition"
            title="Remove"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}
      <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap shrink-0">{member.addedOn}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserManagement({
  currentPlan    = "base",
  existingAdmins = [],
  existingUsers  = [],
}) {
  const cfg = PLANS[currentPlan];

  const [admins, setAdmins] = useState([
    DEFAULT_ADMIN,
    ...existingAdmins.map((a, i) => ({
      ...a,
      id:        a.id        ?? -(i + 1),
      username:  a.username  ?? usernameFromName(a.name ?? "admin"),
      password:  a.password  ?? "••••••••••",
      isDefault: false,
      addedOn:   a.addedOn   ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    })),
  ]);

  const [users, setUsers] = useState(
    existingUsers.map((u, i) => ({
      ...u,
      id:        u.id        ?? -(i + 100),
      username:  u.username  ?? usernameFromName(u.name ?? "user"),
      password:  u.password  ?? "••••••••••",
      isDefault: false,
      addedOn:   u.addedOn   ?? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    }))
  );

  const [modal,      setModal]      = useState(null);
  const [credsFor,   setCredsFor]   = useState(null);
  const [limitAlert, setLimitAlert] = useState("");

  const tryAdd = (role) => {
    if (role === "admin" && admins.length >= cfg.maxAdmins)
      return setLimitAlert(`Admin limit reached (${admins.length}/${cfg.maxAdmins}). Upgrade your plan to add more admins.`);
    if (role === "user" && users.length >= cfg.maxUsers)
      return setLimitAlert(`User limit reached (${users.length}/${cfg.maxUsers}). Upgrade your plan to add more users.`);
    setLimitAlert("");
    setModal(role);
  };

  const addMember = (member) => {
    if (member.role === "admin") setAdmins(a => [...a, member]);
    else                         setUsers(u  => [...u, member]);
    setCredsFor(member);
  };

  const removeMember = (id, role) => {
    if (role === "admin") setAdmins(a => a.filter(m => m.id !== id));
    else                  setUsers(u  => u.filter(m => m.id !== id));
  };

  return (
    <div className="mt-8">
      {modal && <AddMemberModal role={modal} onClose={() => setModal(null)} onAdd={addMember} />}
      {credsFor && <CredentialsModal member={credsFor} onClose={() => setCredsFor(null)} />}

      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">User Management</h2>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            Manage admins and agents on your{" "}
            <span className={`font-semibold ${cfg.statColor}`}>{cfg.label}</span> plan
          </p>
        </div>
        {/* <div className="flex items-center gap-2">
          <button
            onClick={() => tryAdd("admin")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add Admin
          </button>
          <button
            onClick={() => tryAdd("user")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#059669] text-white text-xs font-semibold hover:bg-emerald-700 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            Add User
          </button>
        </div> */}
      </div>

      {/* ── Current plan banner (single card, no plan comparison grid) ── */}
      <div className={`mb-6 rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-4 ${cfg.borderColor} ${cfg.bgColor}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${cfg.badgeColor}`}>
            {cfg.label[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label} Plan</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${cfg.badgeColor}`}>Active</span>
            </div>
            <p className={`text-[11px] mt-0.5 ${cfg.statColor}`}>
              {cfg.price} · Up to {cfg.maxAdmins} admins · {cfg.maxUsers} users (agents)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className={`text-xl font-bold ${cfg.statColor}`}>{admins.length}/{cfg.maxAdmins}</div>
            <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Admins</div>
          </div>
          <div className={`w-px h-8 ${cfg.dividerColor}`} />
          <div className="text-center">
            <div className="text-xl font-bold text-[#059669] dark:text-[#34D399]">{users.length}/{cfg.maxUsers}</div>
            <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Users</div>
          </div>
          <div className={`w-px h-8 ${cfg.dividerColor}`} />
          <div className="text-center">
            <div className="text-xl font-bold text-[#0F1117] dark:text-[#F0F2FA]">
              {admins.length + users.length}/{cfg.maxAdmins + cfg.maxUsers}
            </div>
            <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Total</div>
          </div>
        </div>
      </div>

      {/* Limit alert */}
      {limitAlert && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D]">
          <svg className="w-4 h-4 text-[#DC2626] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <p className="text-xs font-semibold text-[#991B1B] dark:text-[#F87171] flex-1">{limitAlert}</p>
          <button onClick={() => setLimitAlert("")} className="text-[#DC2626] dark:text-[#F87171] text-[11px] font-bold hover:underline">
            Upgrade Plan
          </button>
        </div>
      )}

      {/* ── Member panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Admins */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                <h3 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Admins</h3>
              </div>
              <SlotBar used={admins.length} max={cfg.maxAdmins} isAdmin />
            </div>
            <button
              onClick={() => tryAdd("admin")}
              disabled={admins.length >= cfg.maxAdmins}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                admins.length >= cfg.maxAdmins
                  ? "bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed"
                  : "bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Admin
            </button>
          </div>
          <div className="px-5 py-2 max-h-80 overflow-y-auto">
            {admins.map(m => (
              <MemberRow key={m.id} member={m} onRemove={id => removeMember(id, "admin")} onViewCreds={setCredsFor} />
            ))}
          </div>
        </div>

        {/* Users / Agents */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                <h3 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                  Users <span className="text-xs font-normal text-[#8B92A9] dark:text-[#565C75]">(Agents)</span>
                </h3>
              </div>
              <SlotBar used={users.length} max={cfg.maxUsers} isAdmin={false} />
            </div>
            <button
              onClick={() => tryAdd("user")}
              disabled={users.length >= cfg.maxUsers}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                users.length >= cfg.maxUsers
                  ? "bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed"
                  : "bg-green-50 dark:bg-green-950/40 text-[#059669] dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/60"
              }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add User
            </button>
          </div>
          <div className="px-5 py-2 max-h-80 overflow-y-auto">
            {users.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                </div>
                <p className="text-xs text-[#8B92A9] dark:text-[#565C75]">No users (agents) added yet</p>
              </div>
            ) : (
              users.map(m => (
                <MemberRow key={m.id} member={m} onRemove={id => removeMember(id, "user")} onViewCreds={setCredsFor} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}