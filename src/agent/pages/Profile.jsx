import { useState } from 'react';
import { disablePhoneAlerts, enablePhoneAlerts, notificationPermission, phoneAlertsOn } from '../alerts.jsx';
import { pushActive, savePushPrefs, sendTestPush } from '../push.js';
import { LEAD_TIMES, setAlertPrefs, useAlertPrefs } from '../alertPrefs.js';
import ConfirmSheet from '../components/ConfirmSheet.jsx';
import { useToast } from '../components/Toast.jsx';
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
  const [askSignOut, setAskSignOut] = useState(false);

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
            This web app covers leads, remarks, follow-ups, calls by day and attendance. On iPhone, calls you make
            with the Call button here are logged with an approximate length; attach the call recording to get the exact
            length. You stay signed in on this phone until you sign out.
          </p>
        </div>

        <div className="section">
          <button className="btn block danger" onClick={() => setAskSignOut(true)}>
            Sign out
          </button>
        </div>
      </div>
      <ConfirmSheet
        open={askSignOut}
        title="Sign out of SkyUp CRM?"
        body="You’ll stop getting notifications on this phone and need your email and password to sign in again."
        confirmLabel="Sign out"
        onConfirm={() => { setAskSignOut(false); logout(); }}
        onClose={() => setAskSignOut(false)}
      />
    </>
  );
}

function Switch({ label, sub, on, onToggle, disabled }) {
  return (
    <button onClick={onToggle} disabled={disabled} aria-pressed={on}>
      <span className="setting-text"><span>{label}</span>{sub ? <span className="small muted">{sub}</span> : null}</span>
      <span className={`switch${on ? ' on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  );
}

function PhoneAlerts() {
  const prefs = useAlertPrefs();
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const change = (patch) => { setAlertPrefs(patch); savePushPrefs(); };
  const test = async () => { setTesting(true); const r = await sendTestPush(); setTesting(false); toast(r.message); };
  const [on, setOn] = useState(phoneAlertsOn());
  const [perm, setPerm] = useState(notificationPermission());
  const needsInstall = isIOS() && !isStandalone();

  const toggle = async () => {
    if (on) { disablePhoneAlerts(); setOn(false); return; }
    const r = await enablePhoneAlerts();
    setPerm(r);
    setOn(r === 'granted');
  };

  let note = 'Get a phone notification for new leads, follow-ups, call-backs and remote clock-in, even when SkyUp CRM is closed.';
  if (on && !pushActive()) note = 'Notifications arrive only while SkyUp CRM is open in the background. To get them when it is closed, turn this off and on again.';
  if (perm === 'unsupported' && needsInstall) note = 'On iPhone, add SkyUp CRM to your Home Screen first (Share → Add to Home Screen), then turn this on.';
  else if (perm === 'unsupported') note = 'This browser can’t show notifications. Alerts still appear inside the app.';
  else if (perm === 'denied') note = 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.';

  return (
    <div className="section">
      <div className="section-head"><h2>Alerts</h2></div>
      <div className="settings">
        <Switch label="Phone notifications" sub="Show alerts on the lock screen, even when the app is closed"
          on={on} onToggle={toggle} disabled={perm === 'unsupported' || perm === 'denied'} />
      </div>
      <p className="small muted" style={{ margin: '8px 2px 0' }}>{note}</p>
      {on && pushActive() ? (
        <button className="btn block ghost sm" style={{ marginTop: 10 }} onClick={test} disabled={testing}>
          {testing ? 'Sending…' : 'Send a test notification'}
        </button>
      ) : null}

      <div className="group-label">What to alert me about</div>
      <div className="settings">
        <Switch label="New leads" sub="When a lead is assigned or moved to you"
          on={prefs.newLeads} onToggle={() => change({ newLeads: !prefs.newLeads })} />
        <Switch label="Follow-up reminders" sub="Before a follow-up call you scheduled"
          on={prefs.followUps} onToggle={() => change({ followUps: !prefs.followUps })} />
        {prefs.followUps ? (
          <div className="setting-sub">
            <span className="small muted">Remind me before the follow-up</span>
            <div className="seg" role="group" aria-label="Remind me before a follow-up">
              {LEAD_TIMES.map((m) => (
                <button key={m} className={prefs.followUpLeadMin === m ? 'on' : ''} aria-pressed={prefs.followUpLeadMin === m}
                  onClick={() => change({ followUpLeadMin: m })}>{m} min</button>
              ))}
            </div>
          </div>
        ) : null}
        <Switch label="Overdue follow-ups" sub="Summary of missed follow-ups and leads with no follow-up date"
          on={prefs.followUpSummary} onToggle={() => change({ followUpSummary: !prefs.followUpSummary })} />
      </div>
      <p className="small muted" style={{ margin: '8px 2px 0' }}>Remote clock-in replies are always shown.</p>
    </div>
  );
}
