// src/components/ClockInGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full lockout for EMPLOYEES (role "user") until they clock in for the day.
// While not clocked in, every employee route renders this clock-in screen
// instead of its normal content. Admins / super-admins / developers are never
// gated (this component is only mounted inside UserRoute).
//
// UI-gate only — the backend still enforces its own rules; this just prevents
// employees from using the app before clocking in.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import api from "../data/axiosConfig";

// Read the stored user role without coupling to App.jsx's helper.
function getStoredRole() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return (u?.role || "").toLowerCase();
  } catch {
    return "";
  }
}

export default function ClockInGate({ children }) {
  const role = getStoredRole();
  const isEmployee = role === "user";

  const [checking,  setChecking]  = useState(isEmployee);
  const [clockedIn, setClockedIn] = useState(false);
  const [clocking,  setClocking]  = useState(false);
  const [error,     setError]     = useState("");

  const refresh = useCallback(async () => {
    if (!isEmployee) return; // non-employees are never gated
    try {
      const res = await api.get("/attendance/my-today");
      const rec = res.data;
      const isIn = !!rec?.loginTime && !rec?.logoutTime;
      setClockedIn(isIn);
    } catch {
      // On a transient error, don't hard-lock — let them through rather than
      // trapping a legitimately-clocked-in employee behind a failed check.
      setClockedIn(true);
    } finally {
      setChecking(false);
    }
  }, [isEmployee]);

  useEffect(() => { refresh(); }, [refresh]);

  // Non-employees (admin / super-admin / developer) pass straight through.
  if (!isEmployee) return children;

  const handleClockIn = async () => {
    setClocking(true);
    setError("");
    try {
      // Try to attach the device location (some companies enforce a geofence).
      let body = {};
      try {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error("no geo"));
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 10000, maximumAge: 60000,
          });
        });
        body = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch { /* location optional — backend decides if it's required */ }

      await api.post("/attendance/clock-in", body);
      await refresh();
    } catch (e) {
      setError(e.response?.data?.message || "Could not clock in. Please try again.");
    } finally {
      setClocking(false);
    }
  };

  // While the status is loading, show a neutral splash so we never flash the
  // app content for a not-clocked-in user.
  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F8F9FC] dark:bg-[#0D0F14]">
        <svg className="w-6 h-6 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-[13px] text-[#8B92A9]">Checking attendance…</span>
      </div>
    );
  }

  if (clockedIn) return children;

  // ── Lockout screen ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#F8F9FC] dark:bg-[#0D0F14]">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1.5">
          Clock in to get started
        </h1>
        <p className="text-[13px] text-[#8B92A9] leading-relaxed mb-6">
          You need to clock in before you can access your leads, calls and other
          tools for today. Tap the button below to start your shift.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-left">
            <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[12px] text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}

        <button
          onClick={handleClockIn}
          disabled={clocking}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {clocking ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Clocking in…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Clock In
            </>
          )}
        </button>

        <button
          onClick={refresh}
          className="mt-3 text-[12px] text-[#8B92A9] hover:text-[#2563EB] transition"
        >
          Already clocked in? Refresh
        </button>
      </div>
    </div>
  );
}
