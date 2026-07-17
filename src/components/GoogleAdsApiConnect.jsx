import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";
import { Megaphone, Loader2, Link2, CheckCircle2, ChevronDown, KeyRound, RefreshCw, AlertTriangle } from "lucide-react";
import GoogleOAuthSetupForm from "./GoogleOAuthSetupForm";

// Google Ads API connect card — live metrics (impressions/clicks/cost/etc.).
// Mirrors GoogleAnalyticsConnect: setup form when creds missing → Connect →
// pick account → Sync. After a sync, live spend/clicks/impressions land on the
// per-campaign GoogleAdsConfig docs, so the existing Google Ads dashboard updates.
export default function GoogleAdsApiConnect({ onSynced }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [accounts, setAccounts] = useState(null);
  const [editCreds, setEditCreds] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/google-ads-api/status"); setStatus(data); }
    catch { setStatus({ connected: false, oauthConfigured: true, developerToken: true }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("gads")) { loadStatus(); p.delete("gads"); const q = p.toString(); window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : "")); }
  }, [loadStatus]);

  useEffect(() => {
    if (status?.connected && status?.needsAccount) {
      api.get("/google-ads-api/accounts").then(({ data }) => setAccounts(data.accounts || [])).catch((e) => { setAccounts([]); setError(e?.response?.data?.message || "Could not list accounts."); });
    }
  }, [status]);

  const connect = async () => {
    setBusy(true); setError("");
    try { const { data } = await api.get("/google-ads-api/connect-url"); window.location.href = data.url; }
    catch (e) { setError(e?.response?.data?.message || "Could not start connect."); setBusy(false); }
  };
  const chooseAccount = async (a) => {
    setBusy(true); setError("");
    try { await api.post("/google-ads-api/account", { customerId: a.customerId, customerName: a.customerName }); await loadStatus(); }
    catch (e) { setError(e?.response?.data?.message || "Could not save account."); }
    finally { setBusy(false); }
  };
  const runSync = async () => {
    setSyncing(true); setError(""); setMsg("");
    try {
      const { data } = await api.post("/google-ads-api/sync");
      setMsg(`Synced ${data.campaigns} campaigns (${data.updated} updated, ${data.created} added).`);
      await loadStatus();
      onSynced && onSynced();
    } catch (e) { setError(e?.response?.data?.message || "Sync failed."); }
    finally { setSyncing(false); }
  };
  const disconnect = async () => { if (!window.confirm("Disconnect Google Ads API?")) return; await api.delete("/google-ads-api"); loadStatus(); };
  const onCredsSaved = async () => { setEditCreds(false); await loadStatus(); };

  const CARD = "bg-white dark:bg-[#11131C] border border-[#E4E7EF] dark:border-[#1E2133] rounded-2xl";

  if (loading) return <div className={`${CARD} p-4 flex items-center justify-center`}><Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]" /></div>;

  // Credentials not configured (or editing) → setup form
  if (status?.oauthConfigured === false || editCreds) {
    return (
      <div className={`${CARD} p-4`}>
        <GoogleOAuthSetupForm variant="ads" compact onSaved={onCredsSaved} onCancel={editCreds ? () => setEditCreds(false) : undefined} />
        {status?.developerToken === false && (
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-amber-600"><AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> Server developer token not set (GOOGLE_ADS_DEVELOPER_TOKEN). You can connect, but syncing needs it.</p>
        )}
      </div>
    );
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center"><Megaphone className="w-4.5 h-4.5 text-blue-600" /></div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Google Ads (live metrics)</p>
          <p className="text-[11px] text-[#8B92A9] truncate">{status?.connected ? (status.customerName || status.connectedEmail || "Connected") : "Pull impressions, clicks, cost & conversions automatically"}</p>
        </div>
        {status?.connected && status?.customerId && <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Connected</span>}
      </div>

      {status?.developerToken === false && (
        <p className="mb-3 flex items-start gap-1.5 text-[11px] text-amber-600"><AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> Server developer token not set — set GOOGLE_ADS_DEVELOPER_TOKEN to enable syncing.</p>
      )}
      {error && <p className="text-[12px] text-rose-600 mb-2">{error}</p>}
      {msg && <p className="text-[12px] text-emerald-600 mb-2">{msg}</p>}

      {!status?.connected ? (
        <button onClick={connect} disabled={busy} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-semibold">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Connect Google Ads
        </button>
      ) : status?.needsAccount ? (
        <div className="space-y-1.5">
          <p className="text-[11px] text-[#8B92A9] mb-1">Select the Google Ads account:</p>
          {accounts == null ? <Loader2 className="w-4 h-4 animate-spin text-[#8B92A9]" /> :
            accounts.length === 0 ? <p className="text-[11px] text-[#8B92A9]">No accessible accounts found.</p> :
            accounts.map((a) => (
              <button key={a.customerId} onClick={() => chooseAccount(a)} disabled={busy}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-[#E4E7EF] dark:border-[#1E2133] hover:border-blue-400 text-left text-[12px] disabled:opacity-50">
                <span className="truncate"><span className="font-semibold">{a.customerName}</span> <span className="text-[#8B92A9]">· {a.customerId}</span></span>
                <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-[#8B92A9]" />
              </button>
            ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={runSync} disabled={syncing || status?.developerToken === false}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-semibold">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync now
          </button>
          <button onClick={disconnect} className="px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#1E2133] text-[11px] text-[#8B92A9] hover:text-rose-600 font-semibold">Disconnect</button>
        </div>
      )}

      {status?.connected && !status?.needsAccount && (
        <p className="text-[10px] text-[#8B92A9] mt-2">{status.lastSyncedAt ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}` : "Not synced yet — click Sync now."}</p>
      )}

      {status?.oauthSource === "db" && (
        <button onClick={() => setEditCreds(true)} className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#8B92A9] hover:text-blue-600">
          <KeyRound className="w-3 h-3" /> Edit API credentials
        </button>
      )}
    </div>
  );
}
