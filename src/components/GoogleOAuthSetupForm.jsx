import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import {
  KeyRound, Loader2, Eye, EyeOff, Copy, Check, ChevronDown, ChevronUp,
  ExternalLink, ShieldCheck,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// GoogleOAuthSetupForm
// Lets an admin store the Google OAuth app credentials (Client ID / Secret /
// Redirect URI) straight from the CRM, so Google Analytics can be connected
// without a developer setting GOOGLE_OAUTH_* env vars on the server.
//
// GET  /google-analytics/oauth-config   → prefill + current source (db|env)
// POST /google-analytics/oauth-config    → save (secret encrypted server-side)
//
// Props:
//   onSaved   () => void   called after a successful save (parent reloads status)
//   compact   bool         tighter styling for the Campaigns card
//   onCancel  () => void   optional — shows a Cancel button (used when editing)
// ─────────────────────────────────────────────────────────────────────────────

// Best-effort suggestion for the redirect URI the OAuth client must register.
// Derived at runtime from the app's own API base — never hardcoded.
function suggestedRedirectUri() {
  const base = import.meta.env.VITE_API_URL;
  if (base && /^https?:\/\//i.test(base)) {
    return `${base.replace(/\/+$/, "")}/google-analytics/callback`;
  }
  // Relative "/api" (dev/proxy) — fall back to current origin.
  return `${window.location.origin}/api/google-analytics/callback`;
}

export default function GoogleOAuthSetupForm({ onSaved, compact = false, onCancel }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [source, setSource] = useState(null);

  const [showSecret, setShowSecret] = useState(false);
  const [showGuide, setShowGuide] = useState(!compact);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/google-analytics/oauth-config");
      setClientId(data.clientId || "");
      setRedirectUri(data.redirectUri || suggestedRedirectUri());
      setHasSecret(!!data.hasSecret);
      setSource(data.source || null);
    } catch {
      setRedirectUri(suggestedRedirectUri());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyRedirect = async () => {
    try { await navigator.clipboard.writeText(redirectUri); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  };

  const save = async () => {
    setError("");
    if (!clientId.trim()) return setError("Client ID is required.");
    if (!redirectUri.trim()) return setError("Redirect URI is required.");
    if (!/^https?:\/\//i.test(redirectUri.trim())) return setError("Redirect URI must start with http:// or https://");
    if (!clientSecret.trim() && !hasSecret) return setError("Client Secret is required.");

    setSaving(true);
    try {
      await api.post("/google-analytics/oauth-config", {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(), // blank keeps the existing secret
        redirectUri: redirectUri.trim(),
      });
      onSaved && onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not save credentials.");
    } finally { setSaving(false); }
  };

  const FIELD = "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#11131C] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder-[#B4B9CC] focus:outline-none focus:border-emerald-400";
  const LABEL = "block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5";

  if (loading) {
    return <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]" /></div>;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
          <KeyRound className="w-4.5 h-4.5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Set up Google Analytics</p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">
            Add your Google OAuth credentials to connect GA — no server changes needed.
            {source === "env" && " Server env credentials are active; saving here overrides them for this company."}
          </p>
        </div>
      </div>

      {/* Setup guide */}
      <div className="rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
        <button type="button" onClick={() => setShowGuide((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F8F9FC] dark:bg-[#0D0F14] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> How to get these credentials</span>
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showGuide && (
          <div className="px-3 py-3 text-[11px] leading-relaxed text-[#4B5168] dark:text-[#9DA3BB] space-y-1.5">
            <p>1. Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-emerald-600 font-semibold inline-flex items-center gap-0.5">Google Cloud Console → Credentials <ExternalLink className="w-3 h-3" /></a></p>
            <p>2. Enable <span className="font-semibold">Google Analytics Data API</span> + <span className="font-semibold">Analytics Admin API</span>.</p>
            <p>3. Configure the OAuth consent screen with scope <code className="bg-black/5 dark:bg-white/10 px-1 rounded">analytics.readonly</code>.</p>
            <p>4. Create an <span className="font-semibold">OAuth client ID → Web application</span>.</p>
            <p>5. Under <span className="font-semibold">Authorized redirect URIs</span>, add the exact URI below.</p>
            <p>6. Copy the <span className="font-semibold">Client ID</span> &amp; <span className="font-semibold">Client Secret</span> into the fields here.</p>
          </div>
        )}
      </div>

      {/* Redirect URI (with copy) */}
      <div>
        <label className={LABEL}>Authorized Redirect URI <span className="text-[#DC2626]">*</span></label>
        <div className="relative">
          <input type="text" value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)}
            placeholder="https://your-api-host/api/google-analytics/callback" className={`${FIELD} pr-10`} />
          <button type="button" onClick={copyRedirect} title="Copy" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-emerald-600">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#8B92A9] mt-1">Must match a redirect URI registered on your OAuth client, character-for-character.</p>
      </div>

      {/* Client ID */}
      <div>
        <label className={LABEL}>Client ID <span className="text-[#DC2626]">*</span></label>
        <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)}
          placeholder="1234567890-abc123.apps.googleusercontent.com" className={FIELD} />
      </div>

      {/* Client Secret */}
      <div>
        <label className={LABEL}>Client Secret {hasSecret ? <span className="text-[10px] font-normal text-emerald-600">(saved — leave blank to keep)</span> : <span className="text-[#DC2626]">*</span>}</label>
        <div className="relative">
          <input type={showSecret ? "text" : "password"} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
            placeholder={hasSecret ? "••••••••••••••••" : "GOCSPX-…"} className={`${FIELD} pr-10`} />
          <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168]">
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#8B92A9] mt-1">Stored encrypted on the server. Never shown again after saving.</p>
      </div>

      {error && <p className="text-[12px] text-rose-600">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button onClick={save} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[13px] font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Save &amp; enable connect
        </button>
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
