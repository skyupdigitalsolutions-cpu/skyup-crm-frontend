// src/components/MSG91ConnectSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin interface to connect MSG91 credentials.
// Enables both WhatsApp blast and SMS blast.
//
// Backend expected:
//   GET  /admin/company/msg91-config    → { authKey, integratedNumber, connected }
//   PUT  /admin/company/msg91-config    → body: { authKey, integratedNumber }
//   DELETE /admin/company/msg91-config  → disconnects
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition font-mono";

export default function MSG91ConnectSettings({ onConnected }) {
  const [config,      setConfig]      = useState(null);
  const [authKey,     setAuthKey]     = useState("");
  const [intNumber,   setIntNumber]   = useState("");
  const [showKey,     setShowKey]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState("");
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    api.get("/admin/company/msg91-config")
      .then((res) => {
        setConfig(res.data || {});
        setAuthKey(res.data?.authKey ? "••••••••••••••••" : "");
        setIntNumber(res.data?.integratedNumber || "");
      })
      .catch(() => setConfig({}));
  }, []);

  const handleSave = async () => {
    if (!authKey.trim() || authKey === "••••••••••••••••") {
      setError("Please enter your MSG91 Auth Key"); return;
    }
    if (!intNumber.trim()) {
      setError("Please enter the MSG91 integrated WhatsApp number"); return;
    }
    setSaving(true); setError(""); setSuccess(false);
    try {
      const res = await api.put("/admin/company/msg91-config", {
        authKey: authKey.trim(),
        integratedNumber: intNumber.trim(),
      });
      setConfig(res.data);
      setAuthKey("••••••••••••••••");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onConnected?.();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save MSG91 configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect MSG91? WhatsApp and SMS blasts will stop working until reconnected.")) return;
    setDisconnecting(true);
    try {
      await api.delete("/admin/company/msg91-config");
      setConfig({});
      setAuthKey(""); setIntNumber("");
    } catch {
      setError("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = config?.connected === true;

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isConnected ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-[#F8F9FC] dark:bg-[#13161E]"}`}>
          {/* MSG91 icon */}
          <svg className={`w-5 h-5 ${isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-[#8B92A9]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">MSG91 Integration</h3>
            {isConnected && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">● Connected</span>
            )}
          </div>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Required for WhatsApp blast and SMS blast</p>
        </div>
        {isConnected && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800 text-[12px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
          >
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Steps */}
        <div className="bg-[#F8F9FC] dark:bg-[#13161E] rounded-xl p-4 space-y-2">
          <p className="text-[11px] font-bold text-[#4B5168] dark:text-[#9DA3BB] uppercase tracking-widest mb-2">How to get your credentials</p>
          {[
            "Log in to msg91.com → Settings → API",
            "Copy your Auth Key (keep it secret)",
            "Go to WhatsApp → Integrated Numbers to find your number",
            "Paste both below and click Connect",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">{step}</p>
            </div>
          ))}
        </div>

        {/* Auth Key */}
        <div>
          <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
            MSG91 Auth Key <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={authKey}
              onChange={(e) => setAuthKey(e.target.value)}
              placeholder="Enter your MSG91 auth key"
              className={FIELD_CLS + " pr-10"}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowKey(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#4B5168] transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {showKey
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  : <><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                }
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-[#8B92A9] mt-1">msg91.com → Settings → API → Your Auth Key</p>
        </div>

        {/* Integrated Number */}
        <div>
          <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
            Integrated WhatsApp Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={intNumber}
            onChange={(e) => setIntNumber(e.target.value)}
            placeholder="e.g. 919876543210 (with country code, no +)"
            className={FIELD_CLS}
          />
          <p className="text-[10px] text-[#8B92A9] mt-1">msg91.com → WhatsApp → Integrated Numbers</p>
        </div>

        {/* Brevo note for email */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-xl px-4 py-3">
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            <strong>Email blast</strong> uses Brevo (formerly Sendinblue). Go to <strong>Communications → Email → Settings</strong> to connect your Brevo API key separately.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-[12px] text-emerald-700 dark:text-emerald-400">
            ✓ MSG91 connected! WhatsApp and SMS blasts are now active.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition flex items-center justify-center gap-2"
        >
          {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
          {saving ? "Connecting…" : isConnected ? "Update Credentials" : "Connect MSG91"}
        </button>
      </div>
    </div>
  );
}
