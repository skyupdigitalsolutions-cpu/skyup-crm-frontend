import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import Campaigns from "./components/Campaigns";
import Dailyreport from "./components/DailyReport";
import UpgradePlan from "./components/UpgradePlan";
import ReportPage from "./components/ReportPage";
import UserLogin from "./pages/UserLogin";
import AdminLogin from "./pages/AdminLogin";
import SuperAdminLogin from "./pages/SuperAdminLogin";

// ── Protected Route — redirects to /login if no token ─────────────────────
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// ── Layout with Sidebar — only for protected pages ────────────────────────
function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public login routes (no sidebar) 🔓 ── */}
        <Route path="/login"            element={<UserLogin />} />
        <Route path="/admin/login"      element={<AdminLogin />} />
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />

        {/* ── Protected routes (with sidebar) 🔒 ── */}
        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/reportpage" element={
          <ProtectedRoute>
            <AppLayout><ReportPage /></AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/campaigns" element={
          <ProtectedRoute>
            <AppLayout><Campaigns /></AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/daily-report" element={
          <ProtectedRoute>
            <AppLayout><Dailyreport /></AppLayout>
          </ProtectedRoute>
        }/>
        <Route path="/upgrade-plan" element={ 
          <ProtectedRoute>
            <AppLayout><UpgradePlan /></AppLayout>
          </ProtectedRoute>
        }/>

        {/* ── Fallback — redirect unknown routes to login ── */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}