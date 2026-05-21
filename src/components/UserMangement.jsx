import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../data/axiosConfig";
import { getRole, getStoredUser } from "../data/dataService";

const PLANS = {
  starter:    { label: "Starter",    maxAdmins: 1,  maxUsers: 10,  price: "₹999/mo",   badgeColor: "bg-cyan-600",   borderColor: "border-cyan-500",   bgColor: "bg-cyan-50   dark:bg-cyan-900/30",   textColor: "text-cyan-800   dark:text-cyan-200",   statColor: "text-cyan-600   dark:text-cyan-400",   dividerColor: "bg-cyan-300   dark:bg-cyan-700"   },
  growth:     { label: "Growth",     maxAdmins: 3,  maxUsers: 30,  price: "₹2,499/mo", badgeColor: "bg-violet-600", borderColor: "border-violet-500", bgColor: "bg-violet-50 dark:bg-violet-950/40", textColor: "text-violet-800 dark:text-violet-200", statColor: "text-violet-600 dark:text-violet-400", dividerColor: "bg-violet-300 dark:bg-violet-700" },
  enterprise: { label: "Enterprise", maxAdmins: 5,  maxUsers: 50,  price: "₹5,999/mo", badgeColor: "bg-amber-500",  borderColor: "border-amber-500",  bgColor: "bg-amber-50  dark:bg-amber-900/30",  textColor: "text-amber-800  dark:text-amber-200",  statColor: "text-amber-600  dark:text-amber-400",  dividerColor: "bg-amber-300  dark:bg-amber-700"  },
  basic:      { label: "Starter",    maxAdmins: 1,  maxUsers: 10,  price: "₹999/mo",   badgeColor: "bg-slate-500",  borderColor: "border-slate-500",  bgColor: "bg-slate-50  dark:bg-slate-900/30",  textColor: "text-slate-700 dark:text-slate-300",  statColor: "text-slate-600 dark:text-slate-400",  dividerColor: "bg-slate-300 dark:bg-slate-700"  },
  pro:        { label: "Growth",     maxAdmins: 3,  maxUsers: 30,  price: "₹2,499/mo", badgeColor: "bg-blue-600",   borderColor: "border-blue-500",   bgColor: "bg-blue-50   dark:bg-blue-950/40",   textColor: "text-blue-800  dark:text-blue-200",   statColor: "text-blue-600  dark:text-blue-400",   dividerColor: "bg-blue-300  dark:bg-blue-700"   },
};

export function normalizePlanId(planNameOrId) {
  if (!planNameOrId) return "starter";
  const map = {
    Starter: "starter", starter: "starter", basic: "starter",
    Growth:  "growth",  growth:  "growth",  pro:   "growth",
    Enterprise: "enterprise", enterprise: "enterprise",
  };
  return map[planNameOrId] || "starter";
}

function usernameFromName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ".");
}

const AVATAR_HEX = ["#2563EB","#7C3AED","#0891B2","#059669","#D97706","#DC2626","#0F766E","#9333EA"];
function avatarHex(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = String(str).charCodeAt(i) + ((h << 5) - h);
  return AVATAR_HEX[Math.abs(h) % AVATAR_HEX.length];
}

function EyeIcon({ open }) {
  return open ? (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.126-3.343M9.88 9.88a3 3 0 104.243 4.243M6.343 6.343A9.956 9.956 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.973 9.973 0 01-4.21 5.152M3 3l18 18"/>
    </svg>
  );
}

function passwordStrength(pwd) {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (pwd.length >= 12)          score++;
  if (/[A-Z]/.test(pwd))         score++;
  if (/[0-9]/.test(pwd))         score++;
  if (/[^A-Za-z0-9]/.test(pwd))  score++;
  if (score <= 1) return { label: "Weak",   color: "bg-red-500",    width: "w-1/4"  };
  if (score <= 2) return { label: "Fair",   color: "bg-amber-500",  width: "w-2/4"  };
  if (score <= 3) return { label: "Good",   color: "bg-blue-500",   width: "w-3/4"  };
  return             { label: "Strong", color: "bg-emerald-500", width: "w-full" };
}

function generatePassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Delete Confirmation Modal ──────────────────────────────────────────────────
function DeleteConfirmModal({ member, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false);
  const isAdmin = member.role === "admin";
  const initials = member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const uid = member._id || member.id || member.email;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      style={{ animation: "fadeIn 0.15s ease both" }}
    >
      <div
        className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38]
          rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
        style={{ animation: "slideUp 0.2s cubic-bezier(0.4,0,0.2,1) both" }}
      >
        {/* Red accent bar */}
        <div className="h-1 w-full bg-red-500" />

        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-100 dark:border-red-900/50 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] text-center mb-1">
            Remove {isAdmin ? "Admin" : "Employee"}?
          </h2>
          <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] text-center mb-5 leading-relaxed">
            This action cannot be undone. The account will be permanently deleted.
          </p>

          {/* Member card */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] mb-5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: avatarHex(uid) }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{member.name}</p>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate">{member.email}</p>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold
              ${isAdmin
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                : "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
              }`}
            >
              {member.role === "super_admin" || member.role === "superadmin" ? "Super Admin" : isAdmin ? "Admin" : "Employee"}
            </span>
          </div>

          {/* Warning note */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-5">
            <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              {isAdmin
                ? "Removing this admin will revoke their access to the dashboard immediately."
                : "Removing this employee will unassign all their active leads. This cannot be reversed."}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
                hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600
                text-white text-[13px] font-semibold
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Removing…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                  Yes, Remove
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

// ── Credentials Modal ─────────────────────────────────────────────────────────
function CredentialsModal({ member, onClose, navigate }) {
  const [copied, setCopied] = useState(null);
  const isUser = member.role === "user";
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1800); });
  };
  const handleLoginAsUser = () => {
    sessionStorage.setItem("newUserEmail", member.email);
    sessionStorage.setItem("newUserPassword", member.password);
    navigate("/login");
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex flex-col items-center mb-5">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Account Created</h2>
          <p className="text-xs text-[#8B92A9] dark:text-[#565C75] mt-1 text-center">
            Saved to database · <span className="font-semibold text-blue-600 dark:text-blue-400">{member.email}</span>
          </p>
        </div>
        <div className="space-y-3 mb-5">
          {[{ label: "Email (Login)", value: member.email, key: "email" }, { label: "Password", value: member.password, key: "pass" }].map(({ label, value, key }) => (
            <div key={key} className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl px-4 py-3">
              <p className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1">{label}</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono font-bold text-[#0F1117] dark:text-[#F0F2FA] break-all">{value}</code>
                <button onClick={() => copy(value, key)} className="shrink-0 w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-blue-600 hover:border-blue-400 transition">
                  {copied === key
                    ? <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] text-center mb-4">Share these credentials securely. Password can be changed later.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-xs font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Done</button>
          {isUser && (
            <button onClick={handleLoginAsUser} className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-xs font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14"/></svg>
              Login as User
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Member Modal ──────────────────────────────────────────────────────────
function AddMemberModal({ role, onClose, onAdd, adminList = [], isSuperAdmin = false }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [suggestedPwd, setSuggestedPwd] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = role === "admin";
  const strength = passwordStrength(password);
  const handleGenerate = () => setSuggestedPwd(generatePassword(14));
  const handleUseSuggestion = () => { setPassword(suggestedPwd); setConfirmPassword(suggestedPwd); setShowPwd(true); setSuggestedPwd(""); };
  const handleAdd = async () => {
    if (!name.trim()) return setError("Name is required.");
    if (!email.trim() || !email.includes("@")) return setError("Valid email is required.");
    if (!password) return setError("Password is required.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!isAdmin && isSuperAdmin && !assignedTo) return setError("Please select an admin to assign this employee to.");
    setError(""); setLoading(true);
    try {
      await onAdd({ name: name.trim(), email: email.trim(), phone: phone.trim(), role, password, assignedTo: assignedTo || undefined });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create account. Please try again.");
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isAdmin ? "bg-blue-50 dark:bg-blue-950/40" : "bg-green-50 dark:bg-green-950/40"}`}>
              {isAdmin
                ? <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                : <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              }
            </div>
            <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add {isAdmin ? "Admin" : "Employee"}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        {name.trim() && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
            <svg className="w-3.5 h-3.5 text-[#8B92A9] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">Display name:</span>
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
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] dark:placeholder:text-[#565C75] focus:outline-none focus:border-[#2563EB] transition"
              />
            </div>
          ))}
          {/* Assign to Admin — super admin only, when adding an employee */}
          {!isAdmin && isSuperAdmin && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Assign to Admin *</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition"
              >
                <option value="">— Select an admin —</option>
                {adminList.filter(a => a.role !== "super_admin" && a.role !== "superadmin").map(a => (
                  <option key={a._id || a.id} value={a._id || a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="my-4 flex items-center gap-2">
          <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]"/>
          <span className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Password</span>
          <div className="flex-1 h-px bg-[#E4E7EF] dark:bg-[#262A38]"/>
        </div>
        <div className="mb-3 px-3 py-2.5 rounded-xl bg-[#F0F6FF] dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">Auto-generate a strong password</span>
            </div>
            <button onClick={handleGenerate} className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold transition">Generate</button>
          </div>
          {suggestedPwd ? (
            <div className="flex items-center gap-2 mt-1.5 p-2 rounded-lg bg-white dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
              <code className="flex-1 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 break-all">{suggestedPwd}</code>
              <button onClick={handleUseSuggestion} className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition">Use this</button>
            </div>
          ) : (
            <p className="text-[10px] text-blue-600 dark:text-blue-400">Click Generate to get a secure password suggestion.</p>
          )}
        </div>
        <div className="flex flex-col gap-1 mb-1">
          <label className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Password *</label>
          <div className="relative">
            <input type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password"
              className="w-full px-3 py-2 pr-9 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition font-mono"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168] transition"><EyeIcon open={showPwd}/></button>
          </div>
          {strength && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#E4E7EF] dark:bg-[#262A38] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}/>
              </div>
              <span className={`text-[10px] font-semibold ${strength.label==="Weak"?"text-red-500":strength.label==="Fair"?"text-amber-500":strength.label==="Good"?"text-blue-500":"text-emerald-600"}`}>{strength.label}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 mt-3">
          <label className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Confirm Password *</label>
          <div className="relative">
            <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
              className={`w-full px-3 py-2 pr-9 rounded-xl border bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none transition font-mono ${
                confirmPassword && confirmPassword !== password ? "border-red-400 focus:border-red-500"
                : confirmPassword && confirmPassword === password ? "border-emerald-400 focus:border-emerald-500"
                : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168] transition"><EyeIcon open={showConfirm}/></button>
          </div>
          {confirmPassword && (
            <p className={`text-[10px] mt-1 flex items-center gap-1 ${confirmPassword === password ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
              {confirmPassword === password
                ? <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Passwords match</>
                : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Passwords do not match</>
              }
            </p>
          )}
        </div>
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
          <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p className="text-[11px] text-amber-700 dark:text-amber-400">Use 8+ characters with uppercase, numbers &amp; symbols.</p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-xs font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">Cancel</button>
          <button onClick={handleAdd} disabled={loading} className={`flex-1 py-2 rounded-xl text-white text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${isAdmin ? "bg-[#2563EB] hover:bg-blue-700" : "bg-[#059669] hover:bg-emerald-700"}`}>
            {loading
              ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Creating...</>
              : "Create Account"
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Slot Bar ──────────────────────────────────────────────────────────────────
function SlotBar({ used, max, isAdmin }) {
  const pct = Math.min(Math.round((used / max) * 100), 100);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="w-28 h-1.5 bg-[#E4E7EF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${isAdmin ? "bg-[#2563EB]" : "bg-[#059669]"}`} style={{ width: `${pct}%` }}/>
      </div>
      <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">{used}/{max} slots</span>
    </div>
  );
}

// ── Member Row ────────────────────────────────────────────────────────────────
function MemberRow({ member, onRequestRemove, onViewCreds, onReassign }) {
  const initials = member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const uid = member._id || member.id || member.email;
  const isSuperAdmin = member.role === "super_admin" || member.role === "superadmin";
  const isAdmin = member.role === "admin" || isSuperAdmin;

  const roleBadge = isSuperAdmin
    ? { label: "Super Admin", cls: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" }
    : isAdmin
    ? { label: "Admin", cls: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" }
    : { label: "Employee", cls: "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400" };

  const assignedAdminName = member.assignedTo?.name || null;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] last:border-0 group">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ background: avatarHex(uid) }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{member.name}</p>
          <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${roleBadge.cls}`}>
            {roleBadge.label}
          </span>
        </div>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate">{member.email}</p>
        {/* Show assigned admin for employee rows */}
        {!isAdmin && assignedAdminName && (
          <p className="text-[10px] text-blue-500 dark:text-blue-400 truncate mt-0.5">
            Assigned: {assignedAdminName}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
        {member.password && (
          <button
            onClick={() => onViewCreds(member)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-blue-400 hover:text-blue-600 text-[#8B92A9] transition"
            title="View credentials"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          </button>
        )}
        {/* Edit/Reassign button — super admin only, for users */}
        {onReassign && !isAdmin && (
          <button
            onClick={() => onReassign(member)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#8B92A9] transition"
            title="Reassign admin"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
            </svg>
          </button>
        )}
        {onRequestRemove && !isSuperAdmin && (
          <button
            onClick={() => onRequestRemove(member)}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 text-[#8B92A9] transition"
            title="Remove"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        )}
        {isSuperAdmin && (
          <span
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-500"
            title="Super Admin cannot be deleted"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </span>
        )}
      </div>
      <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] whitespace-nowrap shrink-0">
        {member.addedOn || (member.createdAt ? new Date(member.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "—")}
      </span>
    </div>
  );
}

// ── Reassign Employee Modal (super admin only) ────────────────────────────────────
function ReassignUserModal({ user, adminList, onClose, onReassign }) {
  const [selectedAdmin, setSelectedAdmin] = useState(
    user?.assignedTo?._id || user?.assignedTo || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!selectedAdmin) return setError("Please select an admin.");
    setLoading(true);
    try {
      await onReassign(user._id || user.id, selectedAdmin);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reassign. Please try again.");
      setLoading(false);
    }
  };

  const regularAdmins = adminList.filter(a => a.role !== "super_admin" && a.role !== "superadmin");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-blue-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </div>
              <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Reassign Employee</h2>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Employee info */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: avatarHex(user._id || user.email) }}>
              {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{user.name}</p>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 mb-4">
            <label className="text-[10px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Assign to Admin</label>
            <select
              value={selectedAdmin}
              onChange={e => setSelectedAdmin(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-xs text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition"
            >
              <option value="">— Select an admin —</option>
              {regularAdmins.map(a => (
                <option key={a._id || a.id} value={a._id || a.id}>{a.name} ({a.email})</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-500 mb-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-xs font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
              {loading
                ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Saving…</>
                : "Save Assignment"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function UserManagement({
  currentPlan    = "starter",
  existingAdmins = [],
  existingUsers  = [],
  onMembersChange = null,
}) {
  const planKey = normalizePlanId(currentPlan);
  const cfg = PLANS[planKey] || PLANS.starter;
  const navigate = useNavigate();

  const role = getRole();
  const isCompanySuperAdmin =
    getStoredUser()?.isCompanySuperAdmin === true || role === "superadmin";

  const [admins, setAdmins] = useState([]);
  const [users,  setUsers]  = useState([]);

  const [totalCompanyUsers, setTotalCompanyUsers] = useState(0);

  useEffect(() => {
    api.get("/admin/")
      .then((res) => setAdmins(res.data || []))
      .catch(() => {});

    api.get("/admin/company/users")
      .then((res) => {
        // New shape: { users: [...], totalCompanyUsers: N }
        // Backward-compat: if still a plain array (old backend), handle that too
        if (Array.isArray(res.data)) {
          setUsers(res.data);
          setTotalCompanyUsers(res.data.length);
        } else {
          setUsers(res.data?.users || []);
          setTotalCompanyUsers(res.data?.totalCompanyUsers ?? res.data?.users?.length ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    onMembersChange?.({ admins, users });
  }, [admins, users]);

  useEffect(() => {
    if (existingAdmins.length > 0) setAdmins(existingAdmins.map(a => ({ ...a, isDefault: false })));
  }, [existingAdmins]);

  useEffect(() => {
    if (existingUsers.length > 0) setUsers(existingUsers.map(u => ({ ...u, isDefault: false })));
  }, [existingUsers]);

  // Super Admin is NOT counted against the plan's admin slots
  const regularAdminCount = admins.filter(
    m => m.role !== "super_admin" && m.role !== "superadmin"
  ).length;

  const [modal,         setModal]         = useState(null);
  const [credsFor,      setCredsFor]      = useState(null);
  const [upgradeAlert,  setUpgradeAlert]  = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [reassignFor,   setReassignFor]   = useState(null); // user to reassign

  // Called from a parent (e.g. plan downgrade) to bulk-remove members
  const handleDowngrade = async (adminsToRemove = [], usersToRemove = []) => {
    const removeIds = new Set([
      ...adminsToRemove.map((m) => m._id || m.id),
      ...usersToRemove.map((m)  => m._id || m.id),
    ]);
    setAdmins((a) => a.filter((m) => !removeIds.has(m._id || m.id)));
    setUsers((u)  => u.filter((m) => !removeIds.has(m._id || m.id)));
    await Promise.allSettled([
      ...adminsToRemove.map((m) => api.delete(`/admin/${m._id || m.id}`).catch(() => {})),
      ...usersToRemove.map((m)  => api.delete(`/admin/user/${m._id || m.id}`).catch(() => {})),
    ]);
  };

  const tryAdd = (role) => {
    if (role === "admin" && regularAdminCount >= cfg.maxAdmins) {
      return setUpgradeAlert({
        title: "Admin Limit Reached",
        message: `You are on the ${cfg.label} plan which allows only ${cfg.maxAdmins} admin${cfg.maxAdmins > 1 ? "s" : ""}. To add more admins, please upgrade your plan.`,
        contactSuperAdmin: false,
      });
    }
    if (role === "user" && totalCompanyUsers >= cfg.maxUsers) {
      return setUpgradeAlert(
        isCompanySuperAdmin
          ? {
              title: "Employee Limit Reached",
              message: `You are on the ${cfg.label} plan which allows only ${cfg.maxUsers} users. Please upgrade your plan to add more.`,
              contactSuperAdmin: false,
            }
          : {
              title: "Employee Limit Reached",
              message: `The ${cfg.label} plan limit of ${cfg.maxUsers} users has been reached. Please contact your Super Admin to upgrade the plan.`,
              contactSuperAdmin: true,
            }
      );
    }
    setUpgradeAlert("");
    setModal(role);
  };

  const addMember = async ({ name, email, phone, role, password, assignedTo }) => {
    if (role === "admin") {
      const res = await api.post("/admin/", { name, email, password });
      const member = { ...res.data, phone, role: "admin", password, addedOn: new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) };
      setAdmins(prev => [...prev, member]);
      setModal(null);
      setCredsFor(member);
    } else {
      const res = await api.post("/admin/user", { name, email, password, assignedTo });
      const member = { ...res.data, phone, role: "user", password, addedOn: new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) };
      setUsers(prev => [...prev, member]);
      setTotalCompanyUsers(prev => prev + 1);
      setModal(null);
      setCredsFor(member);
      sessionStorage.setItem("newUserEmail", res.data.email);
      sessionStorage.setItem("newUserPassword", password);
    }
  };

  const requestRemove = (member) => {
    setPendingDelete(member);
  };

  const confirmRemove = async () => {
    if (!pendingDelete) return;
    const { role } = pendingDelete;
    // Super Admin is permanently non-deletable
    if (role === "super_admin" || role === "superadmin") {
      setPendingDelete(null);
      return;
    }
    const id = pendingDelete._id || pendingDelete.id || pendingDelete.email;
    try {
      if (role === "admin") {
        await api.delete(`/admin/${id}`);
        setAdmins(a => a.filter(m => (m._id || m.id) !== id));
      } else {
        await api.delete(`/admin/user/${id}`);
        setUsers(u => u.filter(m => (m._id || m.id) !== id));
        setTotalCompanyUsers(prev => Math.max(0, prev - 1));
      }
    } catch {
      if (role === "admin") setAdmins(a => a.filter(m => (m._id || m.id) !== id));
      else                  setUsers(u  => u.filter(m => (m._id || m.id) !== id));
    } finally {
      setPendingDelete(null);
    }
  };

  const reassignUser = async (userId, newAdminId) => {
    await api.put(`/admin/user/${userId}`, { assignedTo: newAdminId });
    // Update local state with new assigned admin info
    const newAdmin = admins.find(a => (a._id || a.id) === newAdminId);
    setUsers(u => u.map(m =>
      (m._id || m.id) === userId
        ? { ...m, assignedTo: newAdmin ? { _id: newAdmin._id || newAdmin.id, name: newAdmin.name, email: newAdmin.email } : newAdminId }
        : m
    ));
  };

  return (
    <div className="mt-8">
      {modal && (
        <AddMemberModal
          role={modal}
          onClose={() => setModal(null)}
          onAdd={addMember}
          adminList={admins}
          isSuperAdmin={isCompanySuperAdmin}
        />
      )}

      {credsFor && (
        <CredentialsModal member={credsFor} onClose={() => setCredsFor(null)} navigate={navigate} />
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          member={pendingDelete}
          onConfirm={confirmRemove}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {reassignFor && (
        <ReassignUserModal
          user={reassignFor}
          adminList={admins}
          onClose={() => setReassignFor(null)}
          onReassign={reassignUser}
        />
      )}

      {upgradeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex flex-col items-center mb-5">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${upgradeAlert.contactSuperAdmin ? "bg-blue-100 dark:bg-blue-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
                {upgradeAlert.contactSuperAdmin
                  ? <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  : <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                }
              </div>
              <h2 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA] text-center">{upgradeAlert.title}</h2>
              <p className="text-xs text-[#8B92A9] dark:text-[#565C75] mt-2 text-center leading-relaxed">{upgradeAlert.message}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setUpgradeAlert("")} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-xs font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
                {upgradeAlert.contactSuperAdmin ? "OK" : "Cancel"}
              </button>
              {!upgradeAlert.contactSuperAdmin && (
                <button onClick={() => { setUpgradeAlert(""); navigate("/upgrade-plan"); }} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[18px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Employee Management</h2>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            Manage admins and employees on your <span className={`font-semibold ${cfg.statColor}`}>{cfg.label}</span> plan
          </p>
        </div>
      </div>

      {/* Plan banner — super admin sees full stats, admin sees employee stats only */}
      <div className={`mb-6 rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-4 ${cfg.borderColor} ${cfg.bgColor}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${cfg.badgeColor}`}>{cfg.label[0]}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label} Plan</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${cfg.badgeColor}`}>Active</span>
            </div>
            <p className={`text-[11px] mt-0.5 ${cfg.statColor}`}>
              {isCompanySuperAdmin
                ? `${cfg.price} · Up to ${cfg.maxAdmins} admins · ${cfg.maxUsers} users`
                : `Up to ${cfg.maxUsers} users`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {isCompanySuperAdmin && (
            <>
              <div className="text-center">
                <div className={`text-xl font-bold ${cfg.statColor}`}>{regularAdminCount}/{cfg.maxAdmins}</div>
                <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Admins</div>
              </div>
              <div className={`w-px h-8 ${cfg.dividerColor}`}/>
            </>
          )}
          <div className="text-center">
            <div className="text-xl font-bold text-[#059669] dark:text-[#34D399]">{users.length}/{cfg.maxUsers}</div>
            <div className="text-[10px] text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide">Employees</div>
          </div>
          {isCompanySuperAdmin && (
            <>

            </>
          )}
        </div>
      </div>

      {/* Member lists */}
      <div className={`grid grid-cols-1 gap-4 ${isCompanySuperAdmin ? "lg:grid-cols-2" : ""}`}>

        {/* Admins — super admin only */}
        {isCompanySuperAdmin && (
          <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  <h3 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Admins</h3>
                </div>
                <SlotBar used={regularAdminCount} max={cfg.maxAdmins} isAdmin/>
              </div>
              <button
                onClick={() => tryAdd("admin")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 hover:bg-blue-100"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                Add Admin
              </button>
            </div>
            <div className="px-5 py-2 max-h-80 overflow-y-auto">
              {admins.length === 0
                ? <div className="py-8 text-center"><p className="text-xs text-[#8B92A9] dark:text-[#565C75]">No admins yet</p></div>
                : (() => {
                    const superAdminList = admins.filter(m => m.role === "super_admin" || m.role === "superadmin");
                    const regularAdmins  = admins.filter(m => m.role !== "super_admin" && m.role !== "superadmin");
                    return (
                      <>
                        {/* Super Admin section */}
                        {superAdminList.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 py-2 mb-1">
                              <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800/50"/>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                                Super Admin
                              </span>
                              <div className="h-px flex-1 bg-amber-200 dark:bg-amber-800/50"/>
                            </div>
                            {superAdminList.map(m => (
                              <MemberRow
                                key={m._id || m.email}
                                member={{ ...m, role: m.role || "superadmin" }}
                                onRequestRemove={null}
                                onViewCreds={setCredsFor}
                              />
                            ))}
                          </>
                        )}
                        {/* Regular Admins section */}
                        {regularAdmins.length > 0 && (
                          <>
                            <div className="flex items-center gap-2 py-2 mb-1 mt-1">
                              <div className="h-px flex-1 bg-blue-200 dark:bg-blue-800/50"/>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">
                                Admins
                              </span>
                              <div className="h-px flex-1 bg-blue-200 dark:bg-blue-800/50"/>
                            </div>
                            {regularAdmins.map(m => (
                              <MemberRow
                                key={m._id || m.email}
                                member={{ ...m, role: "admin" }}
                                onRequestRemove={requestRemove}
                                onViewCreds={setCredsFor}
                              />
                            ))}
                          </>
                        )}
                        {regularAdmins.length === 0 && superAdminList.length > 0 && (
                          <div className="py-3 text-center">
                            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">No regular admins yet</p>
                          </div>
                        )}
                      </>
                    );
                  })()
              }
            </div>
          </div>
        )}

        {/* Users — visible to both admin and super admin */}
        <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                <h3 className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">Users <span className="text-xs font-normal text-[#8B92A9] dark:text-[#565C75]">(Employees)</span></h3>
              </div>
              <SlotBar used={totalCompanyUsers} max={cfg.maxUsers} isAdmin={false}/>
            </div>
            <button
              onClick={() => tryAdd("user")}
              disabled={totalCompanyUsers >= cfg.maxUsers}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition
                ${totalCompanyUsers >= cfg.maxUsers
                  ? "bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] dark:text-[#565C75] cursor-not-allowed"
                  : "bg-green-50 dark:bg-green-950/40 text-[#059669] dark:text-green-400 hover:bg-green-100"
                }`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Employee
            </button>
          </div>
          <div className="px-5 py-2 max-h-80 overflow-y-auto">
            {users.length === 0
              ? (
                <div className="py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
                  </div>
                  <p className="text-xs text-[#8B92A9] dark:text-[#565C75]">No employees added yet</p>
                </div>
              )
              : users.map(m => (
                  <MemberRow
                    key={m._id || m.email}
                    member={{ ...m, role: "user" }}
                    onRequestRemove={requestRemove}
                    onViewCreds={setCredsFor}
                    onReassign={isCompanySuperAdmin ? setReassignFor : null}
                  />
                ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
