import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import { Globe, Loader2, Link2, CheckCircle2, ChevronDown, KeyRound } from "lucide-react";
import GoogleOAuthSetupForm from "./GoogleOAuthSetupForm";

// Compact GA4 connect card for the Campaigns page (mirrors the Meta connect UX).
// Full analytics live on Report Page → Website Performance.
// When the server OAuth credentials aren't configured, this card now lets the
// admin enter them inline (Client ID / Secret / Redirect URI) instead of asking
// a developer to set env vars.
export default function GoogleAnalyticsConnect() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [properties, setProperties] = useState(null);
  const [editCreds, setEditCreds] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/google-analytics/status"); setStatus(data); }
    catch { setStatus({ connected: false, oauthConfigured: true }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("ga")) { loadStatus(); p.delete("ga"); const q = p.toString(); window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : "")); }
  }, [loadStatus]);

  useEffect(() => { if (status?.connected && status?.needsProperty) { api.get("/google-analytics/properties").then(({ data }) => setProperties(data.properties || [])).catch(() => setProperties([])); } }, [status]);

  const connect = async () => {
    setBusy(true);
    try { const { data } = await api.get("/google-analytics/connect-url"); window.location.href = data.url; }
    catch { setBusy(false); }
  };
  const chooseProperty = async (p) => {
    setBusy(true);
    try { await api.post("/google-analytics/property", { propertyId: p.propertyId, propertyName: p.propertyName }); await loadStatus(); }
    finally { setBusy(false); }
  };
  const disconnect = async () => { if (!window.confirm("Disconnect Google Analytics?")) return; await api.delete("/google-analytics"); loadStatus(); };

  const onCredsSaved = async () => { setEditCreds(false); await loadStatus(); };

  const CARD = "bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl";

  if (loading) return <div className={`${CARD} p-4 flex items-center justify-center`}><Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]" /></div>;

  // Credentials not configured (or admin chose to edit them) → show the setup form.
  if (status?.oauthConfigured === false || editCreds) {
    return (
      <div className={`${CARD} p-4`}>
        <GoogleOAuthSetupForm compact onSaved={onCredsSaved} onCancel={editCreds ? () => setEditCreds(false) : undefined} />
      </div>
    );
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center"><Globe className="w-4.5 h-4.5 text-emerald-600" /></div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Google Analytics</p>
          <p className="text-[11px] text-[#8B92A9] truncate">{status?.connected ? (status.connectedEmail || "Connected") : "Track website performance in Reports"}</p>
        </div>
        {status?.connected && <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Connected</span>}
      </div>

      {!status?.connected ? (
        <button onClick={connect} disabled={busy} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12px] font-semibold">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Connect
        </button>
      ) : status?.needsProperty ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-[#8B92A9] mb-1">Select a GA4 property:</p>
          {properties == null ? <Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]" /> :
            properties.map((p) => (
              <button key={p.propertyId} onClick={() => chooseProperty(p)} disabled={busy}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] hover:border-emerald-400 text-left text-[12px] disabled:opacity-50">
                <span className="truncate">{p.propertyName}</span><ChevronDown className="w-3.5 h-3.5 -rotate-90 text-[#8B92A9]" />
              </button>
            ))}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#8B92A9]">Property: <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{status.propertyName || status.propertyId}</span></p>
          <button onClick={disconnect} className="text-[11px] text-[#8B92A9] hover:text-rose-600 font-semibold">Disconnect</button>
        </div>
      )}

      {/* Manage the OAuth app credentials (only meaningful when set per-company) */}
      {status?.oauthSource === "db" && (
        <button onClick={() => setEditCreds(true)}
          className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#8B92A9] hover:text-emerald-600">
          <KeyRound className="w-3 h-3" /> Edit API credentials
        </button>
      )}
    </div>
  );
}
