// src/hooks/usePlanFeatures.js — UPDATED
// Changes from previous version:
//   1. Added new feature keys: projects, tasks, payroll, website-tracking, websiteTracking
//   These map directly to entitlement booleans returned by the /subscription/my/entitlements endpoint.

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";
import { getUser } from "../data/sessionStore";

// ── Shared entitlement store ─────────────────────────────────────────────────
// ONE cache + ONE in-flight request for the whole tab. Previously every
// component using this hook fired its own /subscription/my/entitlements call,
// and a "plan_updated" event made each of them refetch (and the Sidebar's
// refresh re-dispatched "plan_updated" → endless request loop).
const CACHE_TTL = 60 * 1000;
let _memCache = null;
let _inflight = null;
const _listeners = new Set();

function loadCache() {
  if (_memCache && Date.now() - _memCache.ts < CACHE_TTL) return _memCache.data;
  return null;
}

function saveCache(data) {
  _memCache = { data, ts: Date.now() };
  try { localStorage.removeItem("plan_entitlements"); } catch (_) {}
  try { localStorage.removeItem("plan_features"); } catch (_) {}
  _listeners.forEach((fn) => { try { fn(data); } catch (_) {} });
}

export function clearFeaturesCache() {
  _memCache = null;
  try { localStorage.removeItem("plan_entitlements"); } catch (_) {}
  try { localStorage.removeItem("plan_features"); } catch (_) {}
}

/**
 * Fetch entitlements once for every caller. force=true skips the TTL cache
 * but still shares a request that is already in flight.
 */
export function fetchEntitlements(force = false) {
  if (!force) {
    const cached = loadCache();
    if (cached) return Promise.resolve(cached);
  }
  if (_inflight) return _inflight;
  _inflight = api.get("/subscription/my/entitlements")
    .then(({ data }) => {
      const out = { entitlements: data?.entitlements ?? null, remaining: data?.remaining ?? null };
      if (out.entitlements) saveCache(out);
      return out;
    })
    .catch(() =>
      api.get("/subscription/my/status").then(({ data }) => {
        const features = data?.resolvedFeatures?.features || [];
        const ent = { subscriptionStatus: data?.status, readOnly: data?.readOnly, plan: data?.plan || null };
        for (const f of features) {
          const mapped = FEATURE_KEY_MAP[f.key] || f.key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          ent[mapped] = f.enabled;
        }
        const out = { entitlements: ent, remaining: null };
        saveCache(out);
        return out;
      }).catch(() => null)
    )
    .finally(() => { _inflight = null; });
  return _inflight;
}

// Global listeners — registered once per tab, not once per component.
if (typeof window !== "undefined" && !window.__skyupEntListeners) {
  window.__skyupEntListeners = true;
  window.addEventListener("plan_updated", () => {
    if (getUser()?.role === "developer") return;
    clearFeaturesCache();
    fetchEntitlements(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || getUser()?.role === "developer") return;
    if (!loadCache() && _listeners.size) fetchEntitlements();
  });
}

function getStoredRole() {
  return getUser()?.role || null;
}

// ── Feature key → entitlements boolean key map ────────────────────────────────
// Converts legacy sidebar/FeatureGate keys (e.g. "basic-reports") to the
// entitlements object keys returned by the /my/entitlements endpoint.
export const FEATURE_KEY_MAP = {
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
    let alive = true;
    const onData = (d) => {
      if (!alive || !d) return;
      setEntitlements(d.entitlements ?? null);
      setRemaining(d.remaining ?? null);
      setLoading(false);
    };
    _listeners.add(onData);

    if (getStoredRole() === "developer") {
      setLoading(false);
    } else {
      fetchEntitlements().then((d) => {
        if (!alive) return;
        if (d) onData(d); else { setEntitlements(null); setLoading(false); }
      });
    }
    return () => { alive = false; _listeners.delete(onData); };
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
