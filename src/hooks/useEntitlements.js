// src/hooks/useEntitlements.js — NEW FILE
// Thin wrapper around usePlanFeatures that exposes the full entitlements
// object and helpers for components that need limits (not just feature flags).
//
// Usage:
//   const { entitlements, getLimit, isReadOnly, getRemainingUsage, loading } = useEntitlements();
//   const maxUsers = getLimit("users");          // → number | null
//   const readOnly = isReadOnly();               // → boolean
//   const remaining = getRemainingUsage("transcriptions"); // → number | null

import usePlanFeatures from "./usePlanFeatures";

export default function useEntitlements() {
  const {
    entitlements,
    remaining,
    getLimit,
    isReadOnly,
    getRemainingUsage,
    hasFeature,
    loading,
  } = usePlanFeatures();

  return {
    entitlements,
    remaining,
    getLimit,
    isReadOnly,
    getRemainingUsage,
    hasFeature,
    loading,
    // Convenience: subscriptionStatus string
    subscriptionStatus: entitlements?.subscriptionStatus ?? null,
  };
}
