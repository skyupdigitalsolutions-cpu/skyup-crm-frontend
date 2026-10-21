// src/agent/App.jsx — SkyUp CRM Agent app (installable PWA) at /agent
// ─────────────────────────────────────────────────────────────────────────────
// A phone-first version of the SkyUp CRM mobile app for sales employees:
// clock-in, leads, call + remark, follow-ups. Works on iPhone and Android as
// an installed web app (see ./pwa.js). Same backend endpoints as the mobile app.
// Mounted in src/App.jsx as <Route path="/agent/*">, outside the CRM layout.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AGENT_ROLES, logAppCall } from './api.js';
import { COLD_START_MAX_MS, MIN_AWAY_MS, appCallPayload, flushAppCallQueue, sendAppCall, shouldLogAppCalls } from './appCallLog.js';
import { AlertsProvider } from './alerts.jsx';
import { AttendanceProvider } from './attendance.jsx';
import { AuthProvider, useAuth } from './auth.jsx';
import { LeadsProvider } from './leads.jsx';
import LiveEvents from './LiveEvents.jsx';
import { clearPendingCall, saveReturnedCall, takePendingCall } from './pendingCall.js';
import { useAgentPwa } from './pwa.js';
import { SocketProvider } from './socket.jsx';
import { BottomNav } from './components/Shell.jsx';
import { ToastProvider } from './components/Toast.jsx';
import Calls from './pages/Calls.jsx';
import ClockInGate from './pages/ClockInGate.jsx';
import Home from './pages/Home.jsx';
import LeadDetail from './pages/LeadDetail.jsx';
import Leads from './pages/Leads.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import TermsGate from './pages/TermsGate.jsx';
import './styles.css';

// When the user returns from the phone dialer (app was hidden 5+ seconds),
// open that lead with the remark sheet — the web version of the mobile app's
// post-call remark popup. On iPhone it also logs the call (see appCallLog.js).
function PendingCallResumer() {
  const nav = useNavigate();
  const hiddenAt = useRef(0);
  useEffect(() => {
    const returned = (p, returnedAt) => {
      clearPendingCall();
      const call = saveReturnedCall(p, returnedAt);
      if (shouldLogAppCalls()) sendAppCall(logAppCall, appCallPayload(call));   // kept and retried if offline
      nav(`/agent/leads/${p.leadId}?remark=1`);
    };

    // iOS often closes an installed web app during a long call. When it is opened again soon after,
    // treat that as the return from the call (the real length is unknown then, so none is sent).
    const cold = takePendingCall();
    if (cold) {
      const age = Date.now() - cold.at;
      if (age >= MIN_AWAY_MS && age <= COLD_START_MAX_MS) returned(cold, null);
      else if (age > COLD_START_MAX_MS) clearPendingCall();
    }

    // iPhone call logs that failed offline: send them now and whenever the phone is back online / app reopened
    const flush = () => flushAppCallQueue(logAppCall);
    flush();
    window.addEventListener('online', flush);

    const onVis = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      flush();
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = 0;
      const p = takePendingCall();
      if (!p || away < MIN_AWAY_MS) return;
      returned(p, Date.now());
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', flush); };
  }, [nav]);
  return null;
}

function SignedInApp({ user }) {
  return (
    <TermsGate>
      <SocketProvider userId={user._id}>
      <AlertsProvider>
      <AttendanceProvider>
        <ClockInGate>
          <LeadsProvider userId={user._id || user.email}>
            <PendingCallResumer />
            <LiveEvents />
            <div className="frame">
              <Routes>
                <Route index element={<Home />} />
                <Route path="leads" element={<Leads />} />
                <Route path="leads/:id" element={<LeadDetail />} />
                <Route path="calls" element={<Calls />} />
                <Route path="profile" element={<Profile />} />
                <Route path="*" element={<Navigate to="/agent" replace />} />
              </Routes>
            </div>
            <BottomNav />
          </LeadsProvider>
        </ClockInGate>
      </AttendanceProvider>
      </AlertsProvider>
      </SocketProvider>
    </TermsGate>
  );
}

function NotAnAgent() {
  const { logout } = useAuth();
  return (
    <main className="gate">
      <h1>This app is for sales team members</h1>
      <p className="lead-in">You’re signed in with an admin account. Open the full CRM instead, or sign in with an employee account.</p>
      <a className="btn block" href="/">Open SkyUp CRM</a>
      <button className="btn block ghost" style={{ marginTop: 10 }} onClick={logout}>Sign in with another account</button>
    </main>
  );
}

function Root() {
  const { user } = useAuth();
  if (!user) return <Login />;
  if (!AGENT_ROLES.includes(String(user.role || '').toLowerCase())) return <NotAnAgent />;
  // key resets all data providers when a different user signs in.
  return <SignedInApp key={user._id || user.email} user={user} />;
}

export default function AgentApp() {
  useAgentPwa();

  // Page background + title while the agent app is on screen.
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'SkyUp CRM';
    document.body.classList.add('agent-body');
    return () => { document.title = prevTitle; document.body.classList.remove('agent-body'); };
  }, []);

  return (
    <div className="agent-app">
      <AuthProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </AuthProvider>
    </div>
  );
}
