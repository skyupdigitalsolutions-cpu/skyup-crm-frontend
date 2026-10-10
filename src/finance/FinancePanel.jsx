// src/finance/FinancePanel.jsx — NEW FILE
// The standalone Finance Panel shell (/finance): its own header, dark-mode
// toggle and sign-out, wrapped around the Finance Dashboard. Independent of the
// CRM layout and session (same idea as the Performance Marketing panel).
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Wallet, Sun, Moon, LogOut } from "lucide-react";
import FinanceDashboard from "../components/FinanceDashboard";
import financeApi from "./financeApi";
import { getFinanceToken, getFinanceUser, clearFinanceSession } from "./financeSessionStore";

export default function FinancePanel() {
  const nav = useNavigate();
  const token = getFinanceToken();
  const user = getFinanceUser() || {};
  const [dark, setDark] = useState(() => localStorage.getItem("fin_dark") === "true");

  // Apply dark mode for this panel only; put the page back how we found it.
  useEffect(() => {
    const root = document.documentElement;
    const was = root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    try { localStorage.setItem("fin_dark", String(dark)); } catch { /* ignore */ }
    return () => root.classList.toggle("dark", was);
  }, [dark]);

  if (!token) return <Navigate to="/finance/login" replace />;

  const logout = () => { clearFinanceSession(); nav("/finance/login"); };

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 dark:bg-[#0B0E14] dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-[#1F2533] dark:bg-[#0F131B]/95">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white"><Wallet className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight">Finance Panel</p>
              <p className="truncate text-[12px] text-slate-500">{user.companyName || ""}</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setDark(!dark)} aria-label="Toggle dark mode" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900 dark:border-[#1F2533] dark:hover:text-white">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <span className="hidden items-center gap-1.5 text-[13px] text-slate-600 md:flex dark:text-slate-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[12px] font-semibold dark:bg-white/10">{(user.name || "F").charAt(0).toUpperCase()}</span>
              {user.name || "Finance"}
            </span>
            <button onClick={logout} aria-label="Log out" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:text-red-600 dark:border-[#1F2533]"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-5 md:px-6">
        <FinanceDashboard embedded basePath="" client={financeApi} />
      </main>
    </div>
  );
}
