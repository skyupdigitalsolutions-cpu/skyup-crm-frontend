import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../data/axiosConfig";
import CRMEncryption from "../utils/CRMEncryption";
import toast from "react-hot-toast";
import { ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";

const crm = new CRMEncryption();

export default function UserLogin() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  // ── BIP39 mnemonic setup/restore state (needed when admin logs in) ─────────
  const [showMnemonicModal, setShowMnemonicModal] = useState(false);
  const [showRestoreModal,  setShowRestoreModal]  = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState("");
  const [restoreInput,      setRestoreInput]      = useState("");
  const [mnemonicConfirmed, setMnemonicConfirmed] = useState(false);
  const [restoreLoading,    setRestoreLoading]    = useState(false);
  const [restoreError,      setRestoreError]      = useState("");
  const [pendingToken,      setPendingToken]      = useState(null);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Please fill in all fields.");
    setLoading(true);
    setError("");
    try {
      const res  = await api.post("/auth/login", { email, password });
      const role = res.data.role || "employee";
      const token = res.data.token;

      // ── Super admin blocked at the backend — surface the message ──────────
      // (backend returns 403 with redirectTo, but just in case it slips through)
      if (role === "super_admin" || role === "superadmin") {
        setError("Super Admin accounts must use the Super Admin login page.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({
        _id:         res.data._id,
        name:        res.data.name,
        email:       res.data.email,
        companyId:   res.data.companyId,
        company:     res.data.companyId,
        createdBy:   res.data.createdBy,
        role,
      }));
      // Notify same-tab listeners (window 'storage' event doesn't fire in the same tab)
      window.dispatchEvent(new Event("user_changed"));

      // ── Developer → straight to developer dashboard, no encryption needed ──
      if (role === "developer") {
        toast.success("Developer login successful! Welcome back.");
        navigate("/developer/dashboard");
        return;
      }

      // ── Employee → straight to user dashboard ─────────────────────────────
      if (role === "employee" || role === "user") {
        toast.success("Employee login successful! Welcome back.");
        navigate("/user/dashboard");
        return;
      }

      // ── Admin → check BIP39 encryption setup ──────────────────────────────
      if (role === "admin") {
        const existingKey = crm.getLocalKey();
        if (!existingKey) {
          try {
            const statusRes = await api.get("/privacy/status", {
              headers: { Authorization: `Bearer ${token}` },
            });
            const { dataEncryptionEnabled } = statusRes.data;
            if (!dataEncryptionEnabled) {
              setPendingToken(token);
              const { mnemonic } = await crm.setupEncryption(
                import.meta.env.VITE_API_URL || "http://localhost:5000/api",
                token
              );
              setGeneratedMnemonic(mnemonic);
              setShowMnemonicModal(true);
              return;
            } else {
              setPendingToken(token);
              setShowRestoreModal(true);
              return;
            }
          } catch {
            toast.success("Admin login successful! Welcome back.");
            navigate("/dashboard");
          }
        } else {
          toast.success("Admin login successful! Welcome back.");
          navigate("/dashboard");
        }
        return;
      }

      // ── Fallback ──────────────────────────────────────────────────────────
      toast.success("✅ Login successful! Welcome back.");
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed. Please try again.";
      // If backend explicitly says to go to superadmin login, show a helpful link
      if (err.response?.data?.redirectTo === "/superadmin/login") {
        setError("Super Admin accounts must use the Super Admin login page.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMnemonicConfirmed = () => {
    setShowMnemonicModal(false);
    setGeneratedMnemonic("");
    toast.success("Admin login successful! Welcome back.");
    navigate("/dashboard");
  };

  const handleRestore = async () => {
    if (!restoreInput.trim()) return setRestoreError("Please enter your 12-word phrase.");
    setRestoreLoading(true);
    setRestoreError("");
    try {
      await crm.restoreFromMnemonic(
        restoreInput.trim(),
        import.meta.env.VITE_API_URL || "http://localhost:5000/api",
        pendingToken
      );
      setShowRestoreModal(false);
      toast.success("Admin login successful! Welcome back.");
      navigate("/dashboard");
    } catch (err) {
      setRestoreError(err.message || "Could not restore key. Check your phrase.");
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] flex items-center justify-center px-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        .login-card  { font-family: 'Poppins', sans-serif; }
        .login-title { font-family: 'Poppins', sans-serif; }
        .input-field:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
        .btn-primary { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(37,99,235,0.35); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .fade-in { animation: fadeUp 0.4s ease forwards; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-200/40 dark:bg-blue-900/20 blur-3xl"/>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-200/40 dark:bg-indigo-900/20 blur-3xl"/>
      </div>

      <div className="login-card fade-in relative w-full max-w-md bg-white dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#1E2130] rounded-3xl shadow-2xl shadow-blue-100/50 dark:shadow-none p-8">

        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-6">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>

        <h1 className="login-title text-[26px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Welcome back</h1>
        <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-7">Sign in to your account</p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-start gap-2">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>
              {/* Show a direct link if the error is about superadmin */}
              {error.toLowerCase().includes("super admin") && (
                <Link to="/superadmin/login" className="text-[11px] text-amber-500 hover:text-amber-400 underline mt-1 inline-block">
                  Go to Super Admin login →
                </Link>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" autoComplete="email"
              className="input-field w-full px-4 py-3 rounded-xl border border-[#E4E7EF] dark:border-[#1E2130] bg-[#F8F9FC] dark:bg-[#0D0F14] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="input-field w-full px-4 py-3 pr-11 rounded-xl border border-[#E4E7EF] dark:border-[#1E2130] bg-[#F8F9FC] dark:bg-[#0D0F14] text-[14px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] transition"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A9] hover:text-[#2563EB] transition">
                {showPass
                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                  : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="btn-primary w-full py-3 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Signing in...</>
              : "Sign in"
            }
          </button>
        </form>

        {/* Only link to SuperAdmin — no Admin link since admin uses this same form */}
        <div className="mt-6 pt-5 border-t border-[#E4E7EF] dark:border-[#1E2130] text-center space-y-2">
          <Link to="/forgot-password" className="block text-[12px] text-[#8B92A9] hover:text-blue-600 dark:hover:text-blue-400 transition">
            Forgot your password?
          </Link>
          <Link to="/superadmin/login" className="inline-flex items-center justify-center gap-1.5 text-[12px] text-[#8B92A9] hover:text-amber-500 dark:hover:text-amber-400 transition">
            <ShieldCheck className="w-3.5 h-3.5" /> Super Admin secure login <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── BIP39 Mnemonic Setup Modal (shown to admins on first login) ───────── */}
      {showMnemonicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#13161E] rounded-3xl shadow-2xl p-8 border border-[#EDE9FE] dark:border-[#1E2130]">
            <div className="w-12 h-12 rounded-2xl bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <h2 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Save Your Recovery Phrase</h2>
            <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-5">
              These 12 words are your encryption key. Write them down and store safely.
              If you lose them and clear your browser, <strong className="text-red-500">your lead data cannot be recovered</strong>.
            </p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {generatedMnemonic.split(" ").map((word, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F7FF] dark:bg-[#0D0F14] border border-[#EDE9FE] dark:border-[#262A38]">
                  <span className="text-[10px] font-bold text-[#8B92A9] w-4">{i + 1}.</span>
                  <span className="text-[13px] font-semibold text-[#7C3AED] dark:text-purple-400">{word}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> A backup file was also downloaded to your computer.
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input type="checkbox" checked={mnemonicConfirmed} onChange={e => setMnemonicConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-600" />
              <span className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                I have written down all 12 words and saved the backup file. I understand that losing this phrase means losing access to my encrypted data.
              </span>
            </label>
            <button onClick={handleMnemonicConfirmed} disabled={!mnemonicConfirmed}
              className="w-full py-3 rounded-xl bg-[#7C3AED] text-white text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition">
              I've saved my phrase — Continue to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── BIP39 Restore Modal (admin on new device / cleared browser) ─────── */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md bg-white dark:bg-[#13161E] rounded-3xl shadow-2xl p-8 border border-[#EDE9FE] dark:border-[#1E2130]">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <h2 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">Restore Encryption Key</h2>
            <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mb-5">
              Your encryption key is not found in this browser. Enter your 12-word recovery phrase to restore access to your data.
            </p>
            <label className="block text-[11px] font-semibold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wide mb-1.5">
              Recovery Phrase (12 words)
            </label>
            <textarea value={restoreInput} onChange={e => setRestoreInput(e.target.value)}
              placeholder="apple orange river moon king fish table road cloud sun boat lamp"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-[#EDE9FE] dark:border-[#1E2130] bg-[#F8F7FF] dark:bg-[#0D0F14] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#C4C9D9] dark:placeholder:text-[#3A3F52] focus:outline-none focus:border-[#7C3AED] resize-none mb-3"
            />
            {restoreError && <p className="text-[12px] text-red-500 mb-3">{restoreError}</p>}
            <button onClick={handleRestore} disabled={restoreLoading}
              className="w-full py-3 rounded-xl bg-[#2563EB] text-white text-[14px] font-semibold disabled:opacity-60 hover:bg-blue-700 transition flex items-center justify-center gap-2">
              {restoreLoading
                ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Verifying...</>
                : "Restore & Continue"
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
