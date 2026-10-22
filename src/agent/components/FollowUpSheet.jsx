// src/agent/components/FollowUpSheet.jsx — "Set / Change follow-up" straight from the lead page.
// Saves only the date (PATCH /lead/:id { followUpDate }); the server schedules it like a follow-up set with a
// remark, replacing the oldest pending one, and the reminder notification follows it.
import { useState } from 'react';
import { updateLead } from '../api.js';
import { fmtRelativeDay, toLocalInput } from '../format.js';
import Sheet from './Sheet.jsx';

function at(dayOffset, hour, minute = 0) {
  const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hour, minute, 0, 0); return d;
}
function quickPicks(now = new Date()) {
  const inHours = (h) => { const d = new Date(now.getTime() + h * 3600000); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; };
  const nextMonday = (() => { const d = at(0, 11); const add = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate() + add); return d; })();
  const list = [
    { label: 'In 1 hour', d: inHours(1) },
    { label: 'In 2 hours', d: inHours(2) },
    ...(now.getHours() < 17 ? [{ label: 'Today 6 PM', d: at(0, 18) }] : []),
    { label: 'Tomorrow 11 AM', d: at(1, 11) },
    { label: 'In 3 days', d: at(3, 11) },
    { label: 'Next Monday', d: nextMonday },
  ];
  return list;
}

// The parent mounts this only while it is open, so each opening starts fresh.
export default function FollowUpSheet({ lead, onClose, onSaved }) {
  const [picks] = useState(() => quickPicks());
  const [value, setValue] = useState(() => (lead.followUpDate && new Date(lead.followUpDate) > new Date() ? toLocalInput(new Date(lead.followUpDate)) : ''));
  const [minValue] = useState(() => toLocalInput(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const d = new Date(value);
    if (!value || Number.isNaN(d.getTime())) { setError('Pick a date and time.'); return; }
    if (d.getTime() < Date.now() - 60000) { setError('Pick a time in the future.'); return; }
    setBusy(true); setError('');
    try {
      await updateLead(lead.id, { followUpDate: d.toISOString() });
      onSaved(d);
    } catch (e) {
      setError(e.message || 'Could not save the follow-up.'); setBusy(false);
    }
  };

  return (
    <Sheet open onClose={busy ? undefined : onClose} label="Set follow-up">
      <h3>{lead.followUpDate ? 'Change follow-up' : 'Set follow-up'}</h3>
      <p className="muted" style={{ margin: '2px 0 12px' }}>When should you call {lead.name?.split(' ')[0] || 'this lead'} again? You’ll get a reminder before it.</p>
      <div className="chip-grid">
        {picks.map((p) => {
          const v = toLocalInput(p.d);
          return <button key={p.label} className={`chip${value === v ? ' on' : ''}`} aria-pressed={value === v} onClick={() => setValue(v)}>{p.label}</button>;
        })}
      </div>
      <label className="field" style={{ marginTop: 16 }}>
        <span>Date and time</span>
        <input className="input" type="datetime-local" value={value} min={minValue} onChange={(e) => setValue(e.target.value)} aria-label="Follow-up date and time" />
      </label>
      {value && !Number.isNaN(new Date(value).getTime()) ? <p className="small muted" style={{ margin: '-6px 2px 12px' }}>Follow-up: <b>{fmtRelativeDay(new Date(value))}</b></p> : null}
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      <button className="btn block" onClick={save} disabled={busy || !value}>{busy ? 'Saving…' : 'Save follow-up'}</button>
    </Sheet>
  );
}
