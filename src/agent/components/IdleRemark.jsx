// src/agent/components/IdleRemark.jsx — "Welcome back": notes for the idle gaps.
// While the app is closed or in the background the server records the gap as a break with reason "Auto Idle" and a note
// status of "pending". The web app resumes by itself on the next activity ping, so this asks about each pending gap
// (same rule as the mobile app's AttendanceWidget) and saves the note with POST /attendance/idle-remark { remark, breakIndex }.
import { useEffect, useMemo, useRef, useState } from 'react';
import { saveIdleRemark } from '../api.js';
import { useAttendance } from '../attendance.jsx';
import { fmtTime } from '../format.js';
import Sheet from './Sheet.jsx';

/** The idle gaps still waiting for a note: Auto Idle + pending, never the break that is running now. */
export const pendingIdleBreaks = (record) => ((record && record.breaks) || [])
  .map((b, index) => ({ ...b, index }))
  .filter((b) => b.reason === 'Auto Idle' && b.remarkStatus === 'pending' && b.index !== record.activeBreakIndex);

export default function IdleRemark() {
  const { record, refresh } = useAttendance();
  const pending = useMemo(() => pendingIdleBreaks(record), [record]);
  const key = pending.length ? `${record.loginTime}|${pending.map((b) => b.index).join(',')}` : '';
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState({});
  const [busy, setBusy] = useState(-1);
  const [error, setError] = useState('');
  const skipped = useRef('');

  useEffect(() => {
    if (!key) { setOpen(false); return undefined; }
    const show = () => { if (document.visibilityState === 'visible' && skipped.current !== key) setOpen(true); };
    show();
    document.addEventListener('visibilitychange', show);
    return () => document.removeEventListener('visibilitychange', show);
  }, [key]);

  const save = async (index) => {
    const text = (notes[index] || '').trim();
    if (!text) return;
    setBusy(index); setError('');
    try {
      await saveIdleRemark(text, index);
      setNotes((n) => { const x = { ...n }; delete x[index]; return x; });
      await refresh();
    } catch (e) { setError(e.message || 'Could not save the note.'); }
    finally { setBusy(-1); }
  };
  const skip = () => { skipped.current = key; setOpen(false); };

  return (
    <Sheet open={open && pending.length > 0} onClose={busy >= 0 ? undefined : skip} label="Welcome back">
      <h3>Welcome back</h3>
      <p className="muted" style={{ margin: '4px 0 12px' }}>
        {pending.length === 1 ? 'You were away for a while. What were you doing?' : `You were away ${pending.length} times. What were you doing?`}
      </p>
      {error ? <div className="alert error" role="alert" style={{ marginBottom: 10 }}>{error}</div> : null}
      {pending.map((b) => (
        <div key={b.index} className="fu-card" data-testid="idle-item">
          <div className="small muted" style={{ marginBottom: 6 }}>{fmtTime(b.startTime)}{b.endTime ? ` – ${fmtTime(b.endTime)}` : ' – now'}</div>
          <textarea className="textarea" aria-label={`Note for ${fmtTime(b.startTime)}`} placeholder="e.g. Client site visit, lunch, meeting" maxLength={300}
            value={notes[b.index] || ''} onChange={(e) => setNotes((n) => ({ ...n, [b.index]: e.target.value }))} disabled={busy >= 0} />
          <button className="btn block" style={{ marginTop: 8 }} disabled={busy >= 0 || !(notes[b.index] || '').trim()} onClick={() => save(b.index)}>
            {busy === b.index ? 'Saving…' : 'Save note'}
          </button>
        </div>
      ))}
      <button className="btn block ghost" disabled={busy >= 0} onClick={skip}>Not now</button>
    </Sheet>
  );
}
