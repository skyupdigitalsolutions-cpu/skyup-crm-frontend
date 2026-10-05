// src/components/PasswordRules.jsx
// Live password checklist shown with every "set password" field.
// Each rule gets a green tick when met and a red cross when not (grey before
// the user starts typing) — same rules the server enforces in
// utils/passwordPolicy.js.
//
// Exports:
//   default PasswordRules  — the checklist panel
//   PasswordStrength       — "Password strength: Strong" + bar (place under the input)
//   PasswordMatch          — "Passwords match / do not match" line for the confirm field
import { getPasswordChecks, passwordStrength } from "../utils/passwordPolicy";

export function RuleIcon({ state }) {
  if (state === "pending") {
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#C4C9DA] dark:text-[#3A3F52]" />
      </svg>
    );
  }
  if (state === "ok") {
    return (
      <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" aria-hidden="true">
        <circle cx="10" cy="10" r="10" className="fill-green-600 dark:fill-green-500" />
        <path d="M5.8 10.4l2.7 2.7 5.7-5.9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" aria-hidden="true">
      <circle cx="10" cy="10" r="10" className="fill-red-600 dark:fill-red-500" />
      <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** "Password strength: Strong" with a bar. Renders nothing until typing starts. */
export function PasswordStrength({ password = "", context = {}, className = "" }) {
  if (!password) return null;
  const s = passwordStrength(password, context);
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
        Password strength: <span className={s.text}>{s.label}</span>
      </p>
      <div className="mt-1 h-1.5 w-full rounded-full bg-[#E4E7EF] dark:bg-[#262A38] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${s.color}`}
          style={{ width: `${(s.score + 1) * 20}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] text-[#8B92A9] dark:text-[#565C75]">
        Avoid passwords that are easy to guess or used on other websites.
      </p>
    </div>
  );
}

/**
 * @param {string}  password
 * @param {{email?:string,name?:string}} context  identity the password must not contain
 * @param {"stack"|"side"} variant  "side" draws a pointer toward the field on the
 *        left (desktop) / above (mobile), like a bank's password screen
 * @param {boolean} showStrength     include the strength meter above the list (stack only)
 * @param {boolean} collapseWhenMet  shrink to a single green line once every rule passes
 */
export default function PasswordRules({
  password = "", context = {}, variant = "stack",
  showStrength = true, collapseWhenMet = false, className = "",
}) {
  const started = password.length > 0;
  const checks  = getPasswordChecks(password, context).filter((c) => !c.extra || started);
  const allMet  = started && checks.every((c) => c.ok);
  const side    = variant === "side";

  const panelCls =
    "relative rounded-xl border bg-white dark:bg-[#13161E] px-3.5 py-3 " +
    (allMet ? "border-green-300 dark:border-green-500/40" : "border-orange-300 dark:border-orange-500/40");

  const arrowColor = allMet ? "border-green-300 dark:border-green-500/40" : "border-orange-300 dark:border-orange-500/40";

  return (
    <div className={className}>
      {!side && showStrength && <PasswordStrength password={password} context={context} className="mb-2" />}

      <div className={panelCls}>
        {side && (
          <>
            {/* pointer toward the field: left on desktop, top on mobile */}
            <span aria-hidden="true" className={`hidden md:block absolute -left-[7px] top-4 w-3 h-3 rotate-45 bg-white dark:bg-[#13161E] border-l border-b ${arrowColor}`} />
            <span aria-hidden="true" className={`md:hidden absolute -top-[7px] left-6 w-3 h-3 rotate-45 bg-white dark:bg-[#13161E] border-l border-t ${arrowColor}`} />
          </>
        )}

        {collapseWhenMet && allMet ? (
          <p className="flex items-center gap-2 text-[11px] font-semibold text-green-700 dark:text-green-400" aria-live="polite">
            <RuleIcon state="ok" /> All password rules met
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Password requirements" aria-live="polite">
            {checks.map((c) => {
              const state = !started ? "pending" : c.ok ? "ok" : "fail";
              return (
                <li key={c.id} className="flex items-start gap-2">
                  <RuleIcon state={state} />
                  <span
                    className={`text-[11px] leading-4 ${
                      state === "ok"     ? "text-green-700 dark:text-green-400"
                      : state === "fail" ? "text-red-600 dark:text-red-400"
                      : "text-[#6B7280] dark:text-[#9DA3BB]"
                    }`}
                  >
                    {c.label}
                    <span className="sr-only">{state === "ok" ? " — met" : state === "fail" ? " — not met" : ""}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** "Passwords match / do not match" line for the confirm field. */
export function PasswordMatch({ password = "", confirm = "" }) {
  if (!confirm) return null;
  const ok = password === confirm;
  return (
    <p className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
      <RuleIcon state={ok ? "ok" : "fail"} />
      {ok ? "Passwords match" : "Passwords do not match"}
    </p>
  );
}
