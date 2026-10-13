import { useState } from 'react';
import { disablePhoneAlerts, enablePhoneAlerts, notificationPermission, phoneAlertsOn } from '../alerts.jsx';
import { isIOS, isStandalone } from '../pwa.js';
import { useAttendance } from '../attendance.jsx';
import { useAuth } from '../auth.jsx';
import { fmtTime, initials } from '../format.js';
import { TopBar } from '../components/Shell.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const { record } = useAttendance();
  // Same light/dark setting as the CRM (saved in this browser).
  const { dark, toggle } = useTheme();

  return (
    <>
      <TopBar title="Profile" />
      <div className="page">
        <div className="profile-card">
          <div className="avatar" aria-hidden="true">{initials(user?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{user?.name || 'Agent'}</div>
            <div className="muted small" style={{ overflowWrap: 'anywhere' }}>{user?.email}</div>
            {user?.companyName ? <div className="muted small">{user.companyName}</div> : null}
          </div>
        </div>

        <div className="section">
          <div className="section-head"><h2>Today</h2></div>
          <dl className="kv">
            <div className="kv-row"><dt>Clocked in</dt><dd>{fmtTime(record?.loginTime)}</dd></div>
            <div className="kv-row"><dt>Breaks</dt><dd>{record?.totalBreakMinutes || 0} min</dd></div>
          </dl>
        </div>

        <PhoneAlerts />

        <div className="section">
          <div className="section-head"><h2>Appearance</h2></div>
          <div className="seg" role="group" aria-label="Theme">
            <button className={!dark ? 'on' : ''} aria-pressed={!dark} onClick={() => dark && toggle()}>Light</button>
            <button className={dark ? 'on' : ''} aria-pressed={dark} onClick={() => !dark && toggle()}>Dark</button>
          </div>
        </div>

        <div className="section">
          <div className="section-head"><h2>About this version</h2></div>
          <p className="small muted" style={{ margin: 0 }}>
            This web app covers leads, remarks, follow-ups, calls by day and attendance. Calls are logged
            automatically only by the Android app. For security you’re signed out when you close the app.
          </p>
        </div>

        <div className="section">
          <button className="btn block danger" onClick={() => { if (window.confirm('Sign out of SkyUp CRM?')) logout(); }}>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

function PhoneAlerts() {
  const [on, setOn] = useState(phoneAlertsOn());
  const [perm, setPerm] = useState(notificationPermission());
  const needsInstall = isIOS() && !isStandalone();

  const toggle = async () => {
    if (on) { disablePhoneAlerts(); setOn(false); return; }
    const r = await enablePhoneAlerts();
    setPerm(r);
    setOn(r === 'granted');
  };

  let note = 'Get a phone notification for new leads and follow-ups while SkyUp CRM is open in the background.';
  if (perm === 'unsupported' && needsInstall) note = 'On iPhone, add SkyUp CRM to your Home Screen first (Share → Add to Home Screen), then turn this on.';
  else if (perm === 'unsupported') note = 'This browser can’t show notifications. Alerts still appear inside the app.';
  else if (perm === 'denied') note = 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.';

  return (
    <div className="section">
      <div className="section-head"><h2>Alerts</h2></div>
      <div className="settings">
        <button onClick={toggle} disabled={perm === 'unsupported' || perm === 'denied'} aria-pressed={on}>
          <span>Phone notifications</span>
          <span className={`switch${on ? ' on' : ''}`} aria-hidden="true"><i /></span>
        </button>
      </div>
      <p className="small muted" style={{ margin: '8px 2px 0' }}>{note}</p>
    </div>
  );
}
