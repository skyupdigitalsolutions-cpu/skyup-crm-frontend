// src/hooks/usePlanFeatures.js — UPDATED
// Changes from previous version:
//   1. Added new feature keys: projects, tasks, payroll, website-tracking, websiteTracking
//   These map directly to entitlement booleans returned by the /subscription/my/entitlements endpoint.

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";
import { getUser } from "../data/sessionStore";

// SECURITY FIX: in-memory cache instead of localStorage for plan_entitlements
const CACHE_TTL = 60 * 1000;
let _memCache = null;

function loadCache() {
  if (_memCache && Date.now() - _memCache.ts < CACHE_TTL) return _memCache.data;
  return null;
}

function saveCache(data) {
  _memCache = { data, ts: Date.now() };
  try { localStorage.removeItem("plan_entitlements"); } catch (_) {}
  try { localStorage.removeItem("plan_features"); } catch (_) {}
}

export function clearFeaturesCache() {
  _memCache = null;
  try { localStorage.removeItem("plan_entitlements"); } catch (_) {}
  try { localStorage.removeItem("plan_features"); } catch (_) {}
}

function getStoredRole() {
  return getUser()?.role || null;
}

// ── Feature key → entitlements boolean key map ────────────────────────────────
// Converts legacy sidebar/FeatureGate keys (e.g. "basic-reports") to the
// entitlements object keys returned by the /my/entitlements endpoint.
const FEATURE_KEY_MAP = {
  "leads":               "leadManagement",
  "contacts":            "contacts",
  "basic-reports":       "basicReports",
  "attendance":          "attendance",
  "daily-report":        "dailyReport",
  "sms-blast":           "smsBlast",
  "whatsapp-blast":      "whatsappBlast",
  "email-blast":         "emailBlast",
  "campaigns":           "campaigns",
  "google-ads":          "googleAds",
  "meta-ads":            "metaAds",
  "linkedin-ads":        "linkedInAds",
  "call-recording":      "callRecording",
  "api-access":          "apiAccess",
  "custom-reports":      "customReports",
  "white-label":         "whiteLabel",
  "voice-bot":           "voiceBot",
  "call-transcription":  "callTranscription",
  "ai-summary":          "aiSummary",
  "whatsapp-automation": "whatsappAutomation",
  "webhook-access":      "webhookAccess",
  "custom-domain":       "customDomain",
  "custom-branding":     "customBranding",
  // NEW
  "projects":            "projects",
  "tasks":               "tasks",
  "payroll":             "payroll",
  "website-tracking":    "websiteTracking",
  "telegram-notification": "telegramNotification",
};

export default function usePlanFeatures() {
  const [entitlements, setEntitlements] = useState(() => loadCache()?.entitlements ?? null);
  const [remaining,    setRemaining]    = useState(() => loadCache()?.remaining    ?? null);
  const [loading,      setLoading]      = useState(!loadCache());

  useEffect(() => {
    const role = getStoredRole();
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
        api.get("/subscription/my/status")
          .then(({ data }) => {
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

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
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

  const hasFeature = (key) => {
    if (!entitlements) return true; // fail-open
    const entKey = FEATURE_KEY_MAP[key] || key;
    if (entKey in entitlements) return !!entitlements[entKey];
    return true; // unknown keys → allow
  };

  const getLimit = (resource) => {
    if (!entitlements) return null;
    return entitlements[resource] ?? null;
  };

  const isReadOnly = () => {
    if (!entitlements) return false;
    return !!entitlements.readOnly;
  };

  const getRemainingUsage = (resource) => {
    if (!remaining) return null;
    return remaining[resource] ?? null;
  };

  const features = entitlements
    ? Object.entries(FEATURE_KEY_MAP).map(([key, entKey]) => ({
        key,
        enabled: !!entitlements[entKey],
      }))
    : null;

  return {
    entitlements,
    remaining,
    getLimit,
    isReadOnly,
    getRemainingUsage,
    hasFeature,
    features,
    loading,
    setEntitlements,
    setRemaining,
    setLoading,
  };
}
