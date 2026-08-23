// src/marketing/MarketingLogin.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mktAuthApi } from "./mktApi";
import { setMktSession } from "./mktSessionStore";
import { Loader2, Eye, EyeOff, BarChart3, AlertCircle } from "lucide-react";

export default function MarketingLogin() {
  const nav = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true); setError("");
    try {
      // Uses dedicated /api/marketing-panel/login — only accepts marketingAccess users
      const { data } = await mktAuthApi.post("/login", { email: email.trim().toLowerCase(), password });
      // SECURITY FIX: mkt_token/mkt_user stored in memory via mktSessionStore,
      // not localStorage — no longer visible in DevTools Storage.
      setMktSession(data.token, {
        name: data.name, email: data.email, role: data.role,
        companyName: data.companyName || data.companyId,
      });
      nav("/marketing");
    } catch (err) {
      const d = err?.response?.data;
      if (d?.marketingOnly || (d?.message || "").toLowerCase().includes("marketing panel")) {
        setError("This account is for the Performance Marketing Panel. You are on the right page — please check your credentials.");
      } else {
        setError(d?.message || "Login failed. Check your credentials.");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-[#0F0F1A] to-violet-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-indigo-500/30">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-[26px] font-extrabold text-white leading-tight">Performance Marketing</h1>
          <p className="text-indigo-300 text-[13px] mt-1">Analytics &amp; Campaign Intelligence Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-[15px] font-bold text-white mb-6">Sign in to your panel</h2>

          {error && (
            <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="admin@yourcompany.com" autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 focus:border-indigo-400 focus:outline-none text-white placeholder-white/30 text-[13px] transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-300 mb-1.5">Password</label>
              <div className="relative">
                <input type={show ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/10 border border-white/10 focus:border-indigo-400 focus:outline-none text-white placeholder-white/30 text-[13px] transition-colors" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-60 text-white font-bold text-[14px] transition-all shadow-lg shadow-indigo-500/25 mt-2 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign in"}
            </button>
          </form>

          <p className="text-center text-[11px] text-white/30 mt-6">
            Use your existing CRM admin credentials.<br />
            Employee accounts do not have access to this panel.
          </p>
        </div>

        <p className="text-center text-[11px] text-indigo-400/50 mt-6">SkyUp CRM · Performance Marketing Panel</p>
      </div>
    </div>
  );
}
