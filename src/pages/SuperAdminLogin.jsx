import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../data/axiosConfig";

// ── 6-box OTP input ────────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputRefs = Array.from({ length: 6 }, () => useRef(null));
  const digits = value.padEnd(6, " ").split("");

  const handleChange = (i, e) => {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    const next  = digits.slice();
    next[i]     = digit || " ";
    onChange(next.join(""));
    if (digit && i < 5) inputRefs[i + 1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      const next = digits.slice();
      if (digits[i].trim()) {
        next[i] = " ";
        onChange(next.join(""));
      } else if (i > 0) {
        inputRefs[i - 1].current?.focus();
      }
    }
    if (e.key === "ArrowLeft"  && i > 0) inputRefs[i - 1].current?.focus();
    if (e.key === "ArrowRight" && i < 5) inputRefs[i + 1].current?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pasted.padEnd(6, " ").slice(0, 6));
    inputRefs[Math.min(pasted.length, 5)].current?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={inputRefs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={d.trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-11 text-center text-xl font-bold rounded-xl border bg-[#0D0F14] text-[#F0F2FA] transition-all
                     border-[#1E2130] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none
                     disabled:opacity-50"
          style={{ height: "52px" }}
        />
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SuperAdminLogin() {
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPass,       setShowPass]       = useState(false);
  const [step,           setStep]           = useState(1);       // 1 = credentials, 2 = OTP
  const [pendingEmail,   setPendingEmail]   = useState("");
  const [otp,            setOtp]            = useState("      "); // 6 spaces default
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [info,           setInfo]           = useState("");
  const navigate = useNavigate();

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (step === 2 && otp.trim().length === 6) handleVerify();
  }, [otp]);

  // ── Step 1: validate credentials → send OTP ──────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Please fill in all fields.");
    setLoading(true); setError(""); setInfo("");
    try {
      const res = await api.post("/superadmin/login", { email, password });
      setPendingEmail(res.data.email || email);
      setOtp("      ");
      setStep(2);
      setInfo(`OTP sent to ${res.data.email || email}. Valid for ${res.data.expiresInMin ?? 10} minutes.`);
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP → get JWT ─────────────────────────────────────────
  const handleVerify = async (e) => {
    e?.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) return setError("Please enter all 6 digits.");
    setLoading(true); setError("");
    try {
      const res = await api.post("/superadmin/verify-otp", { email: pendingEmail, otp: cleanOtp });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify({
        _id:         res.data._id,
        name:        res.data.name,
        email:       res.data.email,
        role:        "super_admin",
        companyId:   res.data.companyId,
        companyName: res.data.companyName,
      }));
      navigate("/superadmin/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true); setError("");
    try {
      const res = await api.post("/superadmin/resend-otp", { email: pendingEmail });
      setOtp("      ");
      setInfo(res.data.message || "New OTP sent.");
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500&display=swap');
    .login-card  { font-family: 'DM Sans', sans-serif; }
    .login-title { font-family: 'Syne', sans-serif; }
    .input-field:focus { outline:none; border-color:#F59E0B; box-shadow:0 0 0 3px rgba(245,158,11,0.15); }
    .btn-primary { transition:transform 0.15s ease,box-shadow 0.15s ease; }
    .btn-primary:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(245,158,11,0.4); }
    .btn-primary:active:not(:disabled) { transform:translateY(0); }
    .fade-in  { animation:fadeUp 0.4s ease forwards; }
    .slide-in { animation:slideIn 0.35s ease forwards; }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes slideIn  { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
    .glow { box-shadow:0 0 80px rgba(245,158,11,0.08),0 0 40px rgba(245,158,11,0.05); }
  `;

  return (
    <div className="min-h-screen bg-[#0D0F14] flex items-center justify-center px-4">
      <style>{css}</style>

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-amber-500/5 blur-3xl"/>
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-orange-500/5 blur-3xl"/>
      </div>

      <div className="login-card glow fade-in relative w-full max-w-md bg-[#13161E] border border-[#1E2130] rounded-3xl p-8">

        {/* Badge + step dots */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400">
            Super Admin
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? "bg-amber-400" : "bg-amber-400/40"}`}/>
            <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? "bg-amber-400" : "bg-[#1E2130]"}`}/>
          </div>
        </div>

        {/* ── Step 1: Credentials ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="slide-in">
            <h1 className="login-title text-[26px] font-bold text-[#F0F2FA] mb-1">Master Control</h1>
            <p className="text-[13px] text-[#565C75] mb-7">Restricted access — SuperAdmin only</p>

            {error && <ErrorBanner msg={error} />}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#565C75] uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="superadmin@crm.com" autoComplete="email"
                  className="input-field w-full px-4 py-3 rounded-xl border border-[#1E2130] bg-[#0D0F14] text-[14px] text-[#F0F2FA] placeholder:text-[#3A3F52] transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#565C75] uppercase tracking-wide mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="current-password"
                    className="input-field w-full px-4 py-3 pr-11 rounded-xl border border-[#1E2130] bg-[#0D0F14] text-[14px] text-[#F0F2FA] placeholder:text-[#3A3F52] transition"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#565C75] hover:text-amber-400 transition">
                    {showPass
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-3 rounded-xl bg-amber-500 text-[#0D0F14] text-[14px] font-bold mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <><Spinner /> Authenticating…</> : "Continue →"}
              </button>
            </form>
          </div>
        )}

        {/* ── Step 2: OTP verification ──────────────────────────────────── */}
        {step === 2 && (
          <div className="slide-in">
            <h1 className="login-title text-[24px] font-bold text-[#F0F2FA] mb-1">Verify your email</h1>
            <p className="text-[13px] text-[#565C75] mb-0.5">OTP sent to</p>
            <p className="text-[13px] font-semibold text-amber-400 mb-6 break-all">{pendingEmail}</p>

            {error && <ErrorBanner msg={error} />}
            {info && !error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-[12px] text-green-400">{info}</p>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              <div>
                <label className="block text-[11px] font-semibold text-[#565C75] uppercase tracking-wide mb-4 text-center">
                  Enter 6-digit OTP
                </label>
                <OtpInput value={otp} onChange={setOtp} disabled={loading} />
              </div>

              <button type="submit" disabled={loading || otp.trim().length !== 6}
                className="btn-primary w-full py-3 rounded-xl bg-amber-500 text-[#0D0F14] text-[14px] font-bold disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <><Spinner /> Verifying…</> : "Verify & Sign In"}
              </button>
            </form>

            <div className="mt-5 flex flex-col items-center gap-3">
              <button onClick={handleResend} disabled={resendCooldown > 0 || loading}
                className="text-[12px] font-medium text-amber-400 hover:text-amber-300 disabled:text-[#565C75] disabled:cursor-not-allowed transition">
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Didn't receive it? Resend OTP"}
              </button>
              <button onClick={() => { setStep(1); setError(""); setInfo(""); setOtp("      "); }}
                className="text-[12px] text-[#565C75] hover:text-[#F0F2FA] transition flex items-center gap-1">
                ← Back to login
              </button>
            </div>
          </div>
        )}

        {/* Footer links */}
        <div className="mt-6 pt-5 border-t border-[#1E2130] text-center">
          <Link to="/login" className="text-[12px] text-[#565C75] hover:text-blue-400 transition">Sign in as Employee / Admin →</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
      <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p className="text-[12px] font-medium text-red-400">{msg}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}
