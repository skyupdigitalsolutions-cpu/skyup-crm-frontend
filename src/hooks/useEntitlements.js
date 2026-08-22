// src/hooks/useEntitlements.js — UPDATED
// Changes:
//  1. Added refreshEntitlements() — imperatively clear cache + re-fetch
//  2. Added readOnlyMode boolean alias (consistent naming in components)
//  3. Added entitlement caching layer (delegates to usePlanFeatures which owns the cache)
//  4. Exposed planId helper for UI that needs to know plan tier without hardcoded checks
//  5. Exposed hasAdminCapacity / hasUserCapacity helpers so UserManagement
//     no longer has to do its own (hardcoded) plan-limit comparisons
//  6. All existing return values are unchanged — fully backward-compat

import { useCallback } from "react";
import usePlanFeatures, { clearFeaturesCache } from "./usePlanFeatures";
import api from "../data/axiosConfig";

export default function useEntitlements() {
  const {
    entitlements,
    remaining,
    getLimit,
    isReadOnly,
    getRemainingUsage,
    hasFeature,
    loading,
    setEntitlements,   // exposed by the updated usePlanFeatures
    setRemaining,
    setLoading,
  } = usePlanFeatures();

  // ── refreshEntitlements — force re-fetch by clearing cache ─────────────────
  // Call this after: plan change, payment success, developer override, addon grant
  const refreshEntitlements = useCallback(async () => {
    clearFeaturesCache();
    setLoading(true);
    try {
      const { data } = await api.get("/subscription/my/entitlements");
      const ent = data?.entitlements ?? null;
      const rem = data?.remaining    ?? null;
      if (ent) {
        setEntitlements(ent);
        setRemaining(rem);
        // Save back to cache via usePlanFeatures
        // SECURITY FIX: plan cache is in usePlanFeatures _memCache, not localStorage
      }
      // Notify all usePlanFeatures consumers in the same tab
      window.dispatchEvent(new Event("plan_updated"));
    } catch {
      // ignore — stale data remains
    } finally {
      setLoading(false);
    }
  }, [setEntitlements, setRemaining, setLoading]);

  // ── readOnlyMode — alias for isReadOnly() to support both call styles ───────
  const readOnlyMode = isReadOnly();

  // ── planId — the active plan key (basic | pro | enterprise | trial | null) ──
  // Use this instead of hardcoded plan === checks
  const planId = entitlements?.plan ?? null;

  // ── Capacity helpers — consume entitlement limits so callers don't math ─────
  /**
   * Returns true if the company can add another admin.
   * @param {number} currentAdminCount — number of regular admins (super_admin excluded)
   */
  const hasAdminCapacity = useCallback(
    (currentAdminCount) => {
      if (!entitlements) return true; // fail-open while loading
      const max = entitlements.admins;
      if (max == null) return true;   // unlimited
      return currentAdminCount < max;
    },
    [entitlements]
  );

  /**
   * Returns true if the company can add another user.
   * @param {number} currentUserCount — total company user count
   */
  const hasUserCapacity = useCallback(
    (currentUserCount) => {
      if (!entitlements) return true;
      const max = entitlements.users;
      if (max == null) return true;
      return currentUserCount < max;
    },
    [entitlements]
  );

  /**
   * Returns the readable plan label (Basic, Pro, Enterprise, Trial).
   * Safe to use in UI copy without hardcoding.
   */
  const getPlanLabel = useCallback(() => {
    const MAP = {
      basic:      "Basic",
      starter:    "Starter",
      pro:        "Pro",
      growth:     "Growth",
      enterprise: "Enterprise",
      trial:      "Trial",
    };
    return MAP[planId] || "Unknown";
  }, [planId]);

  return {
    // ── Core entitlement data ───────────────────────────────────────────────
    entitlements,
    remaining,
    loading,

    // ── Feature / limit helpers ─────────────────────────────────────────────
    hasFeature,
    getLimit,
    getRemainingUsage,

    // ── Read-only helpers ───────────────────────────────────────────────────
    isReadOnly,                          // function form: isReadOnly()
    readOnlyMode,                        // boolean form: const { readOnlyMode } = useEntitlements()

    // ── Subscription state ──────────────────────────────────────────────────
    subscriptionStatus: entitlements?.subscriptionStatus ?? null,
    planId,                              // "basic" | "pro" | "enterprise" | "trial" | null
    getPlanLabel,                        // () => "Basic" | "Pro" | …

    // ── Capacity helpers (replaces hardcoded PLAN_LIMITS comparisons) ───────
    hasAdminCapacity,                    // (count) => boolean
    hasUserCapacity,                     // (count) => boolean

    // ── Imperative refresh ──────────────────────────────────────────────────
    refreshEntitlements,                 // async () => void
  };
}
