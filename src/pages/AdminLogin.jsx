import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../data/axiosConfig";
import CRMEncryption from "../utils/CRMEncryption";

const crm = new CRMEncryption();

export default function AdminLogin() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  // ── BIP39 mnemonic setup/restore state ─────────────────────────────────────
  const [showMnemonicModal,   setShowMnemonicModal]   = useState(false);
  const [showRestoreModal,    setShowRestoreModal]     = useState(false);
  const [generatedMnemonic,   setGeneratedMnemonic]   = useState("");
  const [restoreInput,        setRestoreInput]         = useState("");
  const [mnemonicConfirmed,   setMnemonicConfirmed]   = useState(false);
  const [restoreLoading,      setRestoreLoading]       = useState(false);
  const [restoreError,        setRestoreError]         = useState("");
  const [pendingToken,        setPendingToken]         = useState(null);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError("Please fill in all fields.");
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/admin/login", { email, password });
      const token = res.data.token;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({
        _id:     res.data._id,
        name:    res.data.name,
        email:   res.data.email,
        company: res.data.company,
        role:    "admin",
      }));

      // ── BIP39 Encryption Setup ────────────────────────────────────────────
      const existingKey = crm.getLocalKey();
      if (!existingKey) {
        // No key in localStorage — either new device or first time
        // Check server to know if encryption is already set up
        try {
          const statusRes = await api.get("/privacy/status", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const { dataEncryptionEnabled } = statusRes.data;

          if (!dataEncryptionEnabled) {
            // First-time setup — generate mnemonic, show to user
            setPendingToken(token);
            const { mnemonic } = await crm.setupEncryption(
              import.meta.env.VITE_API_URL || "http://localhost:5000/api",
              token
            );
            setGeneratedMnemonic(mnemonic);
            setShowMnemonicModal(true);
            return; // don't navigate yet — wait for user to confirm they saved phrase
          } else {
            // Encryption is set up but key not in localStorage → restore flow
            setPendingToken(token);
            setShowRestoreModal(true);
            return;
          }
        } catch {
          // If privacy check fails, proceed to dashboard anyway
          navigate("/dashboard");
        }
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── User confirmed they saved the mnemonic phrase ─────────────────────────
  const handleMnemonicConfirmed = () => {
    setShowMnemonicModal(false);
    setGeneratedMnemonic("");
    navigate("/dashboard");
  };

  // ── User restores key from mnemonic on new device ─────────────────────────
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
      navigate("/dashboard");
    } catch (err) {
      setRestoreError(err.message || "Could not restore key. Check your phrase.");
    } finally {
      setRestoreLoading(false);
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

      {/* ── BIP39 Mnemonic Setup Modal ────────────────────────────────────────── */}
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

            {/* Mnemonic words grid */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {generatedMnemonic.split(" ").map((word, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#F8F7FF] dark:bg-[#0D0F14] border border-[#EDE9FE] dark:border-[#262A38]">
                  <span className="text-[10px] font-bold text-[#8B92A9] w-4">{i + 1}.</span>
                  <span className="text-[13px] font-semibold text-[#7C3AED] dark:text-purple-400">{word}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mb-5">
              ✅ A backup file was also downloaded to your computer.
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

      {/* ── BIP39 Restore Modal (new device / cleared browser) ───────────────── */}
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

            {restoreError && (
              <p className="text-[12px] text-red-500 mb-3">{restoreError}</p>
            )}

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