// src/components/FeatureGate.jsx
// Wraps a page/section and shows an upgrade prompt if the feature is disabled.
import usePlanFeatures from "../hooks/usePlanFeatures";
import { useNavigate } from "react-router-dom";

function LockIcon() {
  return (
    <svg className="w-10 h-10 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

export default function FeatureGate({ featureKey, children }) {
  const { hasFeature, loading } = usePlanFeatures();
  const navigate = useNavigate();

  // While loading, render children (fail-open — avoids flash of blocked screen)
  if (loading) return children;
  if (hasFeature(featureKey)) return children;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#F1F4FF] dark:bg-[#1A1D27] flex items-center justify-center mb-5">
        <LockIcon />
      </div>
      <h2 className="text-[20px] font-bold text-[#0F1117] dark:text-[#DDE1F5] mb-2">
        Feature not available
      </h2>
      <p className="text-[13px] text-[#8B92A9] max-w-sm mb-6">
        This feature is not included in your current plan. Upgrade your plan to unlock it.
      </p>
      <button
        onClick={() => navigate("/upgrade-plan")}
        className="px-6 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition"
      >
        View Plans
      </button>
    </div>
  );
}
