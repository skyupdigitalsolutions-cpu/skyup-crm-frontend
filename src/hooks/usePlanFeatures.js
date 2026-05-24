// src/hooks/usePlanFeatures.js
// Fetches and caches the company's resolved plan features.
// Returns a `hasFeature(key)` function used by Sidebar and FeatureGate.
import { useState, useEffect } from "react";
import api from "../data/axiosConfig";

const CACHE_KEY = "plan_features";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (raw && Date.now() - raw.ts < CACHE_TTL) return raw.features;
  } catch {}
  return null;
}

function saveCache(features) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ features, ts: Date.now() })); } catch {}
}

export function clearFeaturesCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

export default function usePlanFeatures() {
  const [features, setFeatures] = useState(() => loadCache());
  const [loading,  setLoading]  = useState(!loadCache());

  useEffect(() => {
    const role = localStorage.getItem("role");
    // Only admin / super_admin have plan features — skip for developer and user
    if (role === "developer") { setLoading(false); return; }

    const cached = loadCache();
    if (cached) { setFeatures(cached); setLoading(false); return; }

    api.get("/subscription/my/status")
      .then(({ data }) => {
        const feats = data?.resolvedFeatures?.features || null;
        setFeatures(feats);
        if (feats) saveCache(feats);
      })
      .catch(() => setFeatures(null))
      .finally(() => setLoading(false));

    // Re-fetch when plan changes (e.g. after payment)
    const handler = () => {
      clearFeaturesCache();
      api.get("/subscription/my/status")
        .then(({ data }) => {
          const feats = data?.resolvedFeatures?.features || null;
          setFeatures(feats);
          if (feats) saveCache(feats);
        })
        .catch(() => {});
    };
    window.addEventListener("plan_updated", handler);
    return () => window.removeEventListener("plan_updated", handler);
  }, []);

  // hasFeature: returns true if feature is enabled OR if no features loaded yet (fail-open)
  const hasFeature = (key) => {
    if (!features) return true; // fail-open: show everything if features not loaded
    const feat = features.find(f => f.key === key);
    return feat ? feat.enabled : true; // unknown keys are allowed
  };

  return { hasFeature, features, loading };
}
