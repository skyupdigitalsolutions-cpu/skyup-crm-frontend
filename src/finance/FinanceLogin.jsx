// src/finance/FinanceLogin.jsx — NEW FILE
// Sign-in page for the standalone Finance Panel (/finance/login).
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff, Wallet, AlertCircle } from "lucide-react";
import { financeAuthApi } from "./financeApi";
import { setFinanceSession } from "./financeSessionStore";

export default function FinanceLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    setLoading(true); setError("");
    try {
      const { data } = await financeAuthApi.post("/login", { email: email.trim().toLowerCase(), password });
      setFinanceSession(data.token, { name: data.name, email: data.email, role: data.role, companyName: data.companyName || "" });
      nav("/finance");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Check your credentials.");
    } finally { setLoading(false); }
  };

  const field = "w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 focus:border-emerald-400 focus:outline-none text-white placeholder-white/30 text-[13px] transition-colors";
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-[#0B1210] to-teal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-emerald-500/30">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <p className="text-emerald-300 text-[11px] font-semibold uppercase tracking-widest mb-1">SkyUp CRM</p>
          <h1 className="text-[26px] font-extrabold text-white leading-tight">Finance Panel</h1>
          <p className="text-emerald-300 text-[13px] mt-1">Invoices, payments &amp; collections</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-[15px] font-bold text-white mb-6">Sign in to your panel</h2>
          {error && (
            <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="finance@yourcompany.com" autoComplete="email" className={field} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">Password</label>
              <div className="relative">
                <input type={show ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="••••••••" autoComplete="current-password" className={`${field} pr-11`} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="text-right -mt-1">
              <Link to="/finance/forgot-password" className="text-[12px] font-medium text-emerald-300 hover:text-white transition-colors">Forgot password?</Link>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-[14px] transition-all shadow-lg shadow-emerald-500/25 mt-2 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign in"}
            </button>
          </form>
          <p className="text-center text-[11px] text-white/30 mt-6">
            Use the finance login your super admin created for you.<br />
            CRM admin and employee accounts can't sign in here.
          </p>
        </div>
        <p className="text-center text-[11px] text-emerald-400/50 mt-6">SkyUp CRM · Finance Panel</p>
      </div>
    </div>
  );
}
