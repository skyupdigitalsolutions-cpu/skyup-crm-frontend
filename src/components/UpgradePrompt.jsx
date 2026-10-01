// src/components/UpgradePrompt.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "This feature isn't in your plan" — shared by the sidebar (locked items),
// FeatureGate (locked pages) and any button that needs a plan feature.
//
//   import { requestUpgrade } from "../utils/upgrade";  ·  import { LockedFeature } from "./UpgradePrompt";
//   requestUpgrade({ featureKey: "googleAds", label: "Google Ads" });   // opens the modal
//   <LockedFeature featureKey="googleAds" label="Google Ads" />          // full-page version
//   <UpgradePromptHost />  (mounted once in App)
//
// Every feature stays VISIBLE in every plan; using one that isn't included
// explains which plans have it and sends the owner to Upgrade Plan. Admins and
// employees can't buy plans, so they're told who to ask instead.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../data/axiosConfig";
import { getUser } from "../data/sessionStore";
import { FEATURE_KEY_MAP } from "../hooks/usePlanFeatures";

import { UPGRADE_EVENT as EVENT } from "../utils/upgrade";

let _plansCache = null;
async function loadPlans() {
  if (_plansCache) return _plansCache;
  try {
    const { data } = await api.get("/subscription/plans");
    const map = data?.plans || {};
    _plansCache = Object.entries(map).map(([key, p]) => ({
      key, name: p.name || key, price: p.price, features: Array.isArray(p.features) ? p.features : [],
    }));
  } catch {
    _plansCache = [];
  }
  return _plansCache;
}

function useRole() {
  const r = String(getUser()?.role || "user").toLowerCase();
  if (r === "super_admin" || r === "superadmin") return "owner";
  if (r === "admin") return "admin";
  return "employee";
}

/** Plans whose feature list contains this feature (by plan key or entitlement key). */
function usePlansWith(featureKey) {
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    let off = false;
    if (!featureKey) return undefined;
    const keys = new Set([featureKey, FEATURE_KEY_MAP[featureKey]].filter(Boolean));
    loadPlans().then((all) => {
      if (off) return;
      setPlans(all.filter((p) => p.features.some((f) => keys.has(f))));
    });
    return () => { off = true; };
  }, [featureKey]);
  return plans;
}

function LockSvg({ className = "w-8 h-8" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function Body({ featureKey, label, reason, message, onUpgrade, onClose, compact }) {
  const role = useRole();
  const plans = usePlansWith(featureKey);
  const name = label || "This feature";
  const isLimit = reason === "limit";
  return (
    <div className="text-center">
      <div className={`${compact ? "w-14 h-14" : "w-20 h-20"} rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/15 dark:to-orange-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4`}>
        <LockSvg className={compact ? "w-7 h-7" : "w-9 h-9"} />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">{isLimit ? "Monthly limit reached" : "Upgrade to unlock"}</p>
      <h2 className="text-[19px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">{name}</h2>
      <p className="text-[13px] text-[#6B7280] dark:text-[#9DA3BB] max-w-sm mx-auto mb-4">
        {isLimit
          ? (message || `You've used this month's ${name} allowance.`)
          : `${name} isn't included in your current plan.`}
        {role === "owner" && (isLimit ? " Upgrade your plan or buy an add-on to continue." : " Upgrade your plan to start using it right away.")}
        {role === "admin" && " Ask your company's super admin to upgrade the plan."}
        {role === "employee" && " Ask your admin to upgrade your company's plan."}
      </p>
      {!isLimit && plans && plans.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-5">
          <span className="text-[12px] text-[#8B92A9] mr-1 self-center">Available in</span>
          {plans.map((p) => (
            <span key={p.key} className="px-2.5 py-1 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">{p.name}</span>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-center">
        {onClose && (
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-white/5">
            {role === "owner" ? "Maybe later" : "OK"}
          </button>
        )}
        {role === "owner" && (
          <button onClick={onUpgrade} className="px-6 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8]">
            {isLimit ? "Upgrade / buy add-on" : "View plans & upgrade"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Full-page locked state (used by FeatureGate). */
export function LockedFeature({ featureKey, label, onGoToPlans }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <Body featureKey={featureKey} label={label} onUpgrade={onGoToPlans || (() => navigate("/upgrade-plan"))} />
    </div>
  );
}

/** Mount once inside the Router — renders the modal on requestUpgrade(). */
export default function UpgradePromptHost() {
  const navigate = useNavigate();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const h = (e) => setInfo(e.detail || {});
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  useEffect(() => {
    if (!info) return undefined;
    const esc = (e) => { if (e.key === "Escape") setInfo(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [info]);

  if (!info) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setInfo(null)}>
      <div className="w-full max-w-md bg-white dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <Body
          compact
          featureKey={info.featureKey}
          label={info.label}
          reason={info.reason}
          message={info.message}
          onClose={() => setInfo(null)}
          onUpgrade={() => { setInfo(null); navigate("/upgrade-plan"); }}
        />
      </div>
    </div>
  );
}
