// src/utils/upgrade.js — open the "Upgrade to unlock" modal from anywhere.
//   requestUpgrade({ featureKey: "googleAds", label: "Google Ads" })
// The modal itself is <UpgradePromptHost /> (components/UpgradePrompt.jsx).
export const UPGRADE_EVENT = "request_upgrade";

/**
 * Turn an API error into the upgrade prompt when it's a plan / quota problem.
 * Returns true when handled (caller should not show its own error).
 *   fallback = { featureKey, label } used when the server doesn't name the feature.
 */
export function handlePlanError(err, fallback = {}) {
  const d = err?.response?.data || {};
  const code = String(d.code || "");
  const status = err?.response?.status;
  const featureKey = d.feature || fallback.featureKey;
  if (["FEATURE_NOT_ENABLED", "TRANSCRIPTION_NOT_AVAILABLE", "RESOURCE_NOT_IN_PLAN"].includes(code)) {
    requestUpgrade({ ...fallback, featureKey });
    return true;
  }
  if (/LIMIT_REACHED$/.test(code) || (status === 429 && /limit/i.test(d.message || ""))) {
    requestUpgrade({ ...fallback, featureKey, reason: "limit", message: d.message });
    return true;
  }
  return false;
}

export function requestUpgrade(info = {}) {
  try { window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail: info })); } catch { /* SSR */ }
}
