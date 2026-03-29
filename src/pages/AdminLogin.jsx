import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../data/axiosConfig";

export default function AdminLogin() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Please fill in all fields.");
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/admin/login", { email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify({
        _id:     res.data._id,
        name:    res.data.name,
        email:   res.data.email,
        company: res.data.company,
        role:    "admin",
      }));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3FF] dark:bg-[#0D0F14] flex items-center justify-center px-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500&display=swap');
        .login-card { font-family: 'DM Sans', sans-serif; }
        .login-title { font-family: 'Syne', sans-serif; }
        .input-field:focus { outline: none; border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
        .btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(124,58,237,0.35); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .fade-in { animation: fadeUp 0.4s ease forwards; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-purple-200/40 dark:bg-purple-900/20 blur-3xl"/>
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-violet-200/40 dark:bg-violet-900/20 blur-3xl"/>
      </div>

      <div className="login-card fade-in relative w-full max-w-md bg-white dark:bg-[#13161E] border border-[#EDE9FE] dark:border-[#1E2130] rounded-3xl shadow-2xl shadow-purple-100/50 dark:shadow-none p-8">

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
        </div>

        <h1 className="login-title text-[26px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Admin Portal</h1>
        <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-7">Sign in to manage your company</p>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@company.com" autoComplete="email"
              className="input-field w-full px-4 py-3 rounded-xl border border-[#EDE9FE] dark:border-[#1E2130] bg-[#F8F7FF] dark:bg-[#0D0F14] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="input-field w-full px-4 py-3 pr-11 rounded-xl border border-[#EDE9FE] dark:border-[#1E2130] bg-[#F8F7FF] dark:bg-[#0D0F14] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] transition"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#7C3AED] transition">
                {showPass
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="btn-primary w-full py-3 rounded-xl bg-[#7C3AED] text-white text-[14px] font-semibold mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Signing in...</>
              : "Sign in as Admin"
            }
          </button>
        </form>

        {/* Links */}
        <div className="mt-6 pt-5 border-t border-[#EDE9FE] dark:border-[#1E2130] flex flex-col items-center gap-2">
          <Link to="/login" className="text-[12px] text-[#8B92A9] hover:text-[#2563EB] dark:hover:text-blue-400 transition">Sign in as User →</Link>
          <Link to="/superadmin/login" className="text-[12px] text-[#8B92A9] hover:text-[#7C3AED] dark:hover:text-purple-400 transition">Sign in as SuperAdmin →</Link>
        </div>
      </div>
    </div>
  );
}