// src/hooks/usePlanFeatures.js — UPDATED
// Changes:
//  1. Switched API call from /subscription/my/status → /subscription/my/entitlements
//  2. Returns the full entitlements object (not just features array)
//  3. Added helpers: getLimit(resource), isReadOnly(), getRemainingUsage(resource)
//  4. Backward-compat: hasFeature(key) still works identically
//  5. NEW: exports setEntitlements, setRemaining, setLoading so useEntitlements
//     can implement refreshEntitlements() without a second fetch layer
//  6. NEW: plan field extracted from entitlements response and stored in entitlements.plan

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";

const CACHE_KEY = "plan_entitlements";
const CACHE_TTL = 60 * 1000; // 1 minute — short TTL so developer changes take effect quickly

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (raw && Date.now() - raw.ts < CACHE_TTL) return raw.data;
  } catch {}
  return null;
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function clearFeaturesCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    // Also clear the old key so stale data doesn't linger
    localStorage.removeItem("plan_features");
  } catch {}
}

function getStoredRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.role || null;
  } catch {
    return null;
  }
}

// ── Feature key → entitlements boolean key map ────────────────────────────────
// Converts legacy sidebar/FeatureGate keys (e.g. "basic-reports") to the
// entitlements object keys returned by the new endpoint (e.g. "basicReports").
const FEATURE_KEY_MAP = {
  "leads":          "leadManagement",
  "contacts":       "contacts",
  "basic-reports":  "basicReports",
  "attendance":     "attendance",
  "daily-report":   "dailyReport",
  "sms-blast":      "smsBlast",
  "whatsapp-blast": "whatsappBlast",
  "email-blast":    "emailBlast",
  "campaigns":      "campaigns",
  "google-ads":     "googleAds",
  "meta-ads":       "metaAds",
  "call-recording": "callRecording",
  "api-access":     "apiAccess",
  "custom-reports": "customReports",
  "white-label":    "whiteLabel",
  "voice-bot":      "voiceBot",
  "call-transcription": "callTranscription",
  "ai-summary":     "aiSummary",
  "whatsapp-automation": "whatsappAutomation",
  "webhook-access": "webhookAccess",
  "custom-domain":  "customDomain",
  "custom-branding":"customBranding",
};

export default function usePlanFeatures() {
  const [entitlements, setEntitlements] = useState(() => loadCache()?.entitlements ?? null);
  const [remaining,    setRemaining]    = useState(() => loadCache()?.remaining    ?? null);
  const [loading,      setLoading]      = useState(!loadCache());

  useEffect(() => {
    const role = getStoredRole();
    // Developers have no company entitlements. Admins, company super-admins AND
    // employees all fetch — employees need them so screens like the WhatsApp
    // blast tab can gate themselves (the /my/entitlements endpoint is protectAny).
    if (role === "developer") {
      setLoading(false);
      return;
    }

    const cached = loadCache();
    if (cached) {
      setEntitlements(cached.entitlements ?? null);
      setRemaining(cached.remaining ?? null);
      setLoading(false);
      return;
    }

    api.get("/subscription/my/entitlements")
      .then(({ data }) => {
        const ent = data?.entitlements ?? null;
        const rem = data?.remaining    ?? null;
        setEntitlements(ent);
        setRemaining(rem);
        if (ent) saveCache({ entitlements: ent, remaining: rem });
      })
      .catch(() => {
        // Fallback: try old endpoint for backward compat
        api.get("/subscription/my/status")
          .then(({ data }) => {
            // Build a minimal entitlements object from legacy response
            const features = data?.resolvedFeatures?.features || [];
            const ent = {
              subscriptionStatus: data?.status,
              readOnly: data?.readOnly,
              plan: data?.plan || null,
            };
            for (const f of features) {
              const mapped = FEATURE_KEY_MAP[f.key] || f.key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
              ent[mapped] = f.enabled;
            }
            setEntitlements(ent);
            saveCache({ entitlements: ent, remaining: null });
          })
          .catch(() => setEntitlements(null));
      })
      .finally(() => setLoading(false));

    // Re-fetch when plan changes (e.g. after payment or developer update)
    const handler = () => {
      clearFeaturesCache();
      api.get("/subscription/my/entitlements")
        .then(({ data }) => {
          const ent = data?.entitlements ?? null;
          const rem = data?.remaining    ?? null;
          setEntitlements(ent);
          setRemaining(rem);
          if (ent) saveCache({ entitlements: ent, remaining: rem });
        })
        .catch(() => {});
    };

    // Also revalidate when the user switches back to this tab — covers the case
    // where a developer changed the company's features in another window/tab.
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        // Only refetch if the cache has expired
        if (!loadCache()) handler();
      }
    };

    window.addEventListener("plan_updated", handler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      window.removeEventListener("plan_updated", handler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  // ── hasFeature — backward-compat with sidebar/FeatureGate ────────────────
  // Accepts both legacy dash-keys ("basic-reports") and entitlement keys ("basicReports")
  const hasFeature = (key) => {
    if (!entitlements) return true; // fail-open
    // Map dash-key to entitlement key
    const entKey = FEATURE_KEY_MAP[key] || key;
    if (entKey in entitlements) return !!entitlements[entKey];
    return true; // unknown keys → allow
  };

  // ── getLimit — returns numeric resource limit ─────────────────────────────
  const getLimit = (resource) => {
    if (!entitlements) return null;
    return entitlements[resource] ?? null;
  };

  // ── isReadOnly — true when subscription is not active or trial ────────────
  const isReadOnly = () => {
    if (!entitlements) return false; // fail-open
    return !!entitlements.readOnly;
  };

  // ── getRemainingUsage — remaining AI units this month ────────────────────
  const getRemainingUsage = (resource) => {
    if (!remaining) return null;
    return remaining[resource] ?? null;
  };

  // Legacy: expose features array for any code that still iterates it
  const features = entitlements
    ? Object.entries(FEATURE_KEY_MAP).map(([key, entKey]) => ({
        key,
        enabled: !!entitlements[entKey],
      }))
    : null;

  return {
    // New
    entitlements,
    remaining,
    getLimit,
    isReadOnly,
    getRemainingUsage,
    // Backward-compat
    hasFeature,
    features,
    loading,
    // Exposed setters — needed by useEntitlements.refreshEntitlements()
    // (Do NOT use these directly in components; use useEntitlements instead)
    setEntitlements,
    setRemaining,
    setLoading,
  };
}
