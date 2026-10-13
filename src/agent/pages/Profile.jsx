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
            This web app covers leads, remarks, follow-ups and attendance. Call logs and call recordings
            are only tracked by the Android app. For security you’re signed out when you close the app.
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
