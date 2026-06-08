// pages/ForgotPassword.jsx
// 3-step password reset via OTP email for admin, super_admin, and employee.
// Step 1: Enter email → Step 2: Enter OTP → Step 3: Set new password

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../data/axiosConfig";
import toast from "react-hot-toast";

// ── Password strength helper ───────────────────────────────────────────────────
function passwordStrength(pwd) {
  if (!pwd) return { label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8)           score++;
  if (/[A-Z]/.test(pwd))        score++;
  if (/[0-9]/.test(pwd))        score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const levels = [
    { label: "Weak",   color: "bg-red-500"    },
    { label: "Fair",   color: "bg-orange-400" },
    { label: "Good",   color: "bg-yellow-400" },
    { label: "Strong", color: "bg-green-500"  },
  ];
  return levels[Math.max(0, score - 1)] || levels[0];
}

export default function ForgotPassword() {
  const navigate = useNavigate();

  // ── Shared state ──────────────────────────────────────────────────────────
  const [step,    setStep]    = useState(1); // 1 | 2 | 3
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Step 1
  const [email, setEmail] = useState("");

  // Step 2
  const [otp,     setOtp]     = useState(["", "", "", "", "", ""]);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Step 3
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const pwStrength = passwordStrength(newPassword);

  // ── Step 1: Request OTP ───────────────────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Please enter your email address.");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password/request", { email: email.trim().toLowerCase() });
      toast.success("OTP sent! Check your inbox.");
      setStep(2);
      startResendCountdown();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP box helpers ───────────────────────────────────────────────────────
  const handleOtpChange = (val, idx) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) {
      document.getElementById(`otp-${idx + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtp(text.split(""));
      document.getElementById("otp-5")?.focus();
      e.preventDefault();
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    const otpStr = otp.join("");
    if (otpStr.length !== 6) return setError("Please enter the complete 6-digit OTP.");
    setLoading(true);
    try {
      // We verify by attempting the reset — if OTP is wrong, backend rejects.
      // Alternatively we could add a verify-only endpoint, but to keep it simple
      // we move to step 3 with OTP in state and do the full reset there.
      // To actually validate OTP without resetting, we call reset at step 3.
      // So just advance to step 3.
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset password ────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    if (!newPassword) return setError("Please enter a new password.");
    if (newPassword.length < 8) return setError("Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await api.post("/auth/forgot-password/reset", {
        email:       email.trim().toLowerCase(),
        otp:         otp.join(""),
        newPassword,
      });
      toast.success("Password reset successfully! Please log in.");
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to reset password.";
      // If OTP is wrong/expired, send user back to OTP step
      if (
        msg.toLowerCase().includes("otp") ||
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("incorrect")
      ) {
        setStep(2);
        setOtp(["", "", "", "", "", ""]);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP countdown ──────────────────────────────────────────────────
  const startResendCountdown = () => {
    setResendCountdown(60);
    const interval = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password/request", { email: email.trim().toLowerCase() });
      toast.success("New OTP sent!");
      setOtp(["", "", "", "", "", ""]);
      startResendCountdown();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputCls = "w-full px-4 py-3 rounded-xl border border-[#E4E7EF] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] transition";
  const btnCls   = "w-full py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[14px] font-semibold mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FF] dark:bg-[#0D0F14] px-4">
      <div className="w-full max-w-md bg-white dark:bg-[#13161E] rounded-3xl shadow-xl border border-[#E4E7EF] dark:border-[#1E2130] p-8">

        {/* ── Logo / Title ── */}
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
            </svg>
          </div>
          <h1 className="text-[22px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Forgot Password</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-1">
            {step === 1 && "Enter your registered email to receive an OTP."}
            {step === 2 && `Enter the 6-digit OTP sent to ${email}`}
            {step === 3 && "Set your new password."}
          </p>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-full h-1.5 rounded-full transition-all ${s <= step ? "bg-blue-500" : "bg-[#E4E7EF] dark:bg-[#1E2130]"}`} />
            </div>
          ))}
        </div>

        {/* ── Error message ── */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* ─────────── STEP 1: Email ─────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                className={inputCls}
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                autoComplete="email"
              />
            </div>

            <button type="submit" disabled={loading} className={btnCls}>
              {loading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Sending OTP…</>
                : "Send OTP"
              }
            </button>
          </form>
        )}

        {/* ─────────── STEP 2: OTP ──────────────────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-3 text-center">
                Enter 6-digit OTP
              </label>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(e.target.value, idx)}
                    onKeyDown={e => handleOtpKeyDown(e, idx)}
                    className="w-11 h-13 text-center text-[18px] font-bold rounded-xl border border-[#E4E7EF] dark:border-[#1E2130] bg-white dark:bg-[#0D0F14] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#3B82F6] transition py-3"
                    style={{ width: "44px" }}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading || otp.join("").length < 6} className={btnCls}>
              {loading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Verifying…</>
                : "Verify OTP"
              }
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0 || loading}
                className="text-[12px] text-[#8B92A9] hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        {/* ─────────── STEP 3: New Password ─────────────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  className={`${inputCls} pr-11`}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
                  {showNew
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
              {/* Strength bar */}
              {newPassword && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-[#E4E7EF] dark:bg-[#1E2130] overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pwStrength.color}`}
                      style={{ width: `${(["Weak","Fair","Good","Strong"].indexOf(pwStrength.label) + 1) * 25}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-[#8B92A9]">{pwStrength.label}</span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  className={`${inputCls} pr-11 ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-red-400 focus:border-red-500"
                      : confirmPassword && confirmPassword === newPassword
                      ? "border-emerald-400 focus:border-emerald-500"
                      : ""
                  }`}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition">
                  {showConfirm
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
              {confirmPassword && (
                <p className={`text-[10px] mt-1 flex items-center gap-1 ${confirmPassword === newPassword ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                  {confirmPassword === newPassword
                    ? <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Passwords match</>
                    : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Passwords do not match</>
                  }
                </p>
              )}
            </div>

            <button type="submit" disabled={loading || newPassword !== confirmPassword || newPassword.length < 8} className={btnCls}>
              {loading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Resetting…</>
                : "Reset Password"
              }
            </button>
          </form>
        )}

        {/* ── Back to login ── */}
        <div className="mt-6 pt-5 border-t border-[#E4E7EF] dark:border-[#1E2130] text-center">
          <Link to="/login" className="text-[12px] text-[#8B92A9] hover:text-blue-600 dark:hover:text-blue-400 transition">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}