// ─────────────────────────────────────────────────────────────────────────────
//  DowngradeWarningModal.jsx
//  Drop-in replacement for the modal used inside UpgradePlan.jsx
//
//  PROPS
//    targetPlan         — plan object (id, name, color, monthlyPrice, …)
//    currentAdmins      — full admin array from UserManagement state
//    currentUsers       — full user array from UserManagement state
//    targetAdminLimit   — max admins allowed on target plan (e.g. 1)
//    targetUserLimit    — max users  allowed on target plan (e.g. 10)
//    onConfirm(adminsToRemove, usersToRemove) — called when user clicks confirm
//    onCancel           — called when user clicks "keep current plan"
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";

// ── Avatar helpers (same palette as UserManagement) ──────────────────────────
const AVATAR_HEX = [
  "#2563EB","#7C3AED","#0891B2","#059669",
  "#D97706","#DC2626","#0F766E","#9333EA",
];
function avatarHex(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++)
    h = String(str).charCodeAt(i) + ((h << 5) - h);
  return AVATAR_HEX[Math.abs(h) % AVATAR_HEX.length];
}
function MemberAvatar({ member }) {
  const uid = member._id || member.id || member.email || "";
  const initials = (member.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
      style={{ background: avatarHex(uid) }}
    >
      {initials}
    </div>
  );
}

// ── Checkbox UI ──────────────────────────────────────────────────────────────
function Checkbox({ checked }) {
  return (
    <div
      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
        checked
          ? "bg-red-500 border-red-500"
          : "border-[#D1D5DB] dark:border-[#3A3F52]"
      }`}
    >
      {checked && (
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
}

// ── Selectable member row ────────────────────────────────────────────────────
function SelectableRow({ member, selected, onToggle, isLast }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(member)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        !isLast ? "border-b border-[#E4E7EF] dark:border-[#262A38]" : ""
      } ${
        selected
          ? "bg-red-50 dark:bg-red-950/20"
          : "hover:bg-[#F8F9FC] dark:hover:bg-[#181B27]"
      }`}
    >
      <MemberAvatar member={member} />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
          {member.name}
        </p>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate">
          {member.email}
        </p>
      </div>
      {selected && (
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[10px] font-semibold mr-1">
          Removing
        </span>
      )}
      <Checkbox checked={selected} />
    </button>
  );
}

// ── Section header with progress badge ──────────────────────────────────────
function SectionHeader({ label, sublabel, selected, needed }) {
  const done = selected >= needed;
  return (
    <div className="px-4 py-2.5 bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
      <div>
        <span className="text-[11px] font-semibold text-[#4B5168] dark:text-[#7B829E]">
          {label}
        </span>
        {sublabel && (
          <span className="ml-1.5 text-[11px] text-[#8B92A9] dark:text-[#565C75]">
            {sublabel}
          </span>
        )}
      </div>
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
          done
            ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400"
            : "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
        }`}
      >
        {done ? (
          <>✓ {selected} selected</>
        ) : (
          <>{selected} / {needed} selected</>
        )}
      </span>
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function DowngradeWarningModal({
  targetPlan,
  currentAdmins,
  currentUsers,
  targetAdminLimit,
  targetUserLimit,
  onConfirm,
  onCancel,
}) {
  // How many need to be removed
  const mustRemoveAdmins = Math.max(0, currentAdmins.length - targetAdminLimit);
  const mustRemoveUsers  = Math.max(0, currentUsers.length  - targetUserLimit);
  const hasAnyRequired   = mustRemoveAdmins > 0 || mustRemoveUsers > 0;

  // Selected IDs (Sets)
  const [selectedAdminIds, setSelectedAdminIds] = useState(new Set());
  const [selectedUserIds,  setSelectedUserIds]  = useState(new Set());

  // Show-all toggles for long user lists
  const VISIBLE_LIMIT = 6;
  const [showAllUsers, setShowAllUsers] = useState(false);

  const visibleUsers = showAllUsers
    ? currentUsers
    : currentUsers.slice(0, VISIBLE_LIMIT);

  const [confirming, setConfirming] = useState(false);

  // Toggle helpers
  function toggleAdmin(member) {
    const id = member._id || member.id;
    setSelectedAdminIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleUser(member) {
    const id = member._id || member.id;
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Derived
  const selectedAdmins = useMemo(
    () => currentAdmins.filter((m) => selectedAdminIds.has(m._id || m.id)),
    [currentAdmins, selectedAdminIds]
  );
  const selectedUsers = useMemo(
    () => currentUsers.filter((m) => selectedUserIds.has(m._id || m.id)),
    [currentUsers, selectedUserIds]
  );

  const adminsDone = selectedAdmins.length >= mustRemoveAdmins;
  const usersDone  = selectedUsers.length  >= mustRemoveUsers;
  const canConfirm = adminsDone && usersDone;

  // Status line text
  const statusParts = [];
  if (!adminsDone) {
    const n = mustRemoveAdmins - selectedAdmins.length;
    statusParts.push(`${n} more admin${n > 1 ? "s" : ""}`);
  }
  if (!usersDone) {
    const n = mustRemoveUsers - selectedUsers.length;
    statusParts.push(`${n} more user${n > 1 ? "s" : ""}`);
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm(selectedAdmins, selectedUsers);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      style={{ animation: "fadeIn 0.15s ease both" }}
    >
      <div
        className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38]
          rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        style={{
          animation: "slideUp 0.2s cubic-bezier(0.4,0,0.2,1) both",
          maxHeight: "90vh",
        }}
      >
        {/* Amber accent bar */}
        <div className="h-1.5 w-full bg-amber-500 shrink-0" />

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">
          <div className="p-6">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-100 dark:border-amber-900/50 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA] text-center mb-1">
              Downgrade to {targetPlan.name}?
            </h2>

            {hasAnyRequired ? (
              <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] text-center mb-5 leading-relaxed">
                The {targetPlan.name} plan allows{" "}
                <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                  {targetAdminLimit} admin{targetAdminLimit !== 1 ? "s" : ""}
                </span>{" "}
                and{" "}
                <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                  {targetUserLimit} users
                </span>
                . Select who to remove to proceed.
              </p>
            ) : (
              <p className="text-[12px] text-[#6B7280] dark:text-[#565C75] text-center mb-5 leading-relaxed">
                Your current team fits within {targetPlan.name} plan limits. No
                members need to be removed.
              </p>
            )}

            {/* ── Admins section ── */}
            {mustRemoveAdmins > 0 && (
              <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden mb-3">
                <SectionHeader
                  label="Admins"
                  sublabel={`(keep ${targetAdminLimit}, remove at least ${mustRemoveAdmins})`}
                  selected={selectedAdmins.length}
                  needed={mustRemoveAdmins}
                />
                {currentAdmins.map((m, i) => (
                  <SelectableRow
                    key={m._id || m.id || m.email}
                    member={m}
                    selected={selectedAdminIds.has(m._id || m.id)}
                    onToggle={toggleAdmin}
                    isLast={i === currentAdmins.length - 1}
                  />
                ))}
              </div>
            )}

            {/* ── Users section ── */}
            {mustRemoveUsers > 0 && (
              <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl overflow-hidden mb-3">
                <SectionHeader
                  label="Users"
                  sublabel={`(keep ${targetUserLimit}, remove at least ${mustRemoveUsers})`}
                  selected={selectedUsers.length}
                  needed={mustRemoveUsers}
                />
                {visibleUsers.map((m, i) => (
                  <SelectableRow
                    key={m._id || m.id || m.email}
                    member={m}
                    selected={selectedUserIds.has(m._id || m.id)}
                    onToggle={toggleUser}
                    isLast={i === visibleUsers.length - 1 && showAllUsers}
                  />
                ))}
                {!showAllUsers && currentUsers.length > VISIBLE_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllUsers(true)}
                    className="w-full px-4 py-2.5 text-[11px] font-semibold text-[#2563EB] dark:text-blue-400
                      hover:bg-[#F8F9FC] dark:hover:bg-[#181B27] transition border-t
                      border-[#E4E7EF] dark:border-[#262A38] text-center"
                  >
                    Show {currentUsers.length - VISIBLE_LIMIT} more users
                  </button>
                )}
              </div>
            )}

            {/* Status line */}
            {hasAnyRequired && (
              <div className="mb-4">
                {canConfirm ? (
                  <p className="text-[12px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4"
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
                    Ready — {selectedAdmins.length + selectedUsers.length} account
                    {selectedAdmins.length + selectedUsers.length !== 1 ? "s" : ""}{" "}
                    selected for removal.
                  </p>
                ) : (
                  <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">
                    Select{" "}
                    <span className="font-semibold text-red-500">
                      {statusParts.join(" and ")}
                    </span>{" "}
                    to enable confirm.
                  </p>
                )}
              </div>
            )}

            {/* Warning */}
            {hasAnyRequired && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mb-5">
                <svg
                  className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  Removed accounts lose access immediately. Their active leads
                  will be unassigned. This cannot be undone.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="px-6 pb-6 shrink-0 bg-white dark:bg-[#1A1D27]">
          {/* Plan chips */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-[11px] text-[#8B92A9]">Switching to:</span>
            <span
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
              style={{
                background: targetPlan.color + "18",
                color: targetPlan.color,
              }}
            >
              {targetPlan.name}
            </span>
            <span className="text-[11px] text-[#8B92A9]">·</span>
            <span className="text-[11px] text-[#8B92A9]">
              Max {targetAdminLimit} admin{targetAdminLimit !== 1 ? "s" : ""} /{" "}
              {targetUserLimit} users
            </span>
          </div>

          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              disabled={confirming}
              className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]
                hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Keep current plan
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || confirming}
              className="flex-1 py-2.5 rounded-xl text-white text-[13px] font-semibold
                transition-colors flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: canConfirm && !confirming ? "#EF4444" : undefined,
              }}
            >
              {confirming ? (
                <>
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
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Preparing checkout…
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
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  {hasAnyRequired ? "Confirm & pay" : "Proceed to pay"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
