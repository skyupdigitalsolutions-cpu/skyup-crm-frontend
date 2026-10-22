// src/agent/pages/Visits.jsx — the mobile app's "Client Visit Log" (field meetings and check-ins), for the /agent app.
// Server: POST /lead/:id/meeting-remark (JSON, or multipart with a photo / document), GET /lead/:id/meeting-remarks,
// POST /lead (a new client). Location uses the phone's GPS while this screen is open (a web app cannot track in the background).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLead, getMeetingRemarks, postMeetingRemark } from '../api.js';
import { TopBar } from '../components/Shell.jsx';
import { useToast } from '../components/Toast.jsx';
import { IconPin } from '../components/icons.jsx';
import { fmtDate, fmtTime, toLocalInput } from '../format.js';
import { useLeads } from '../leads.jsx';

export const VISIT_TYPES = ['In-Person', 'Site Visit', 'Demo', 'Video Call', 'Phone Call'];
export const VISIT_OUTCOMES = ['Interested', 'Follow-Up Required', 'Converted', 'Pending Decision', 'Not Interested', 'No Show'];
const MAX_FILE = 20 * 1024 * 1024;

export default function Visits() {
  const { leads, refresh } = useLeads();
  const toast = useToast();
  const [mode, setMode] = useState('existing');            // existing | new
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);          // { id, name }
  const [nName, setNName] = useState(''); const [nPhone, setNPhone] = useState(''); const [nEmail, setNEmail] = useState(''); const [nNote, setNNote] = useState('');
  const [type, setType] = useState('In-Person');
  const [outcome, setOutcome] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [followUp, setFollowUp] = useState('');
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [error, setError] = useState('');
  const [past, setPast] = useState(null);
  const fileRef = useRef(null); const camRef = useRef(null);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase(); const digits = needle.replace(/\D/g, '');
    if (!needle) return [];
    return leads.filter((l) => l.name.toLowerCase().includes(needle) || (digits.length >= 3 && l.phone.replace(/\D/g, '').includes(digits))).slice(0, 8);
  }, [leads, search]);

  const loadPast = useCallback(async (id) => { setPast(null); setPast(await getMeetingRemarks(id)); }, []);
  useEffect(() => { if (selected) loadPast(selected.id); else setPast(null); }, [selected, loadPast]);

  const checkIn = () => {
    if (!navigator.geolocation) { setError('This phone does not allow location in the browser. Type the place instead.'); return; }
    setGeoBusy(true); setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { const { latitude, longitude, accuracy } = pos.coords; setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)} m)`); setGeoBusy(false); toast('Location added'); },
      (err) => { setGeoBusy(false); setError(err && err.code === 1 ? 'Location is switched off for this app. Allow it in Settings, or type the place.' : 'Could not get your location. Type the place instead.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const pick = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) { setError(`That file is ${(f.size / 1048576).toFixed(1)} MB. The limit is 20 MB.`); return; }
    setError(''); setFile(f);
  };

  const submit = async () => {
    setError('');
    if (mode === 'existing' && !selected) return setError('Choose the client.');
    if (mode === 'new' && !nName.trim()) return setError('Enter the client name.');
    if (mode === 'new' && nPhone.replace(/\D/g, '').length < 10) return setError('Enter a phone number with at least 10 digits.');
    if (!outcome) return setError('Choose the visit outcome.');
    if (!notes.trim()) return setError('Enter the meeting notes.');
    const followUpDate = followUp ? new Date(followUp).toISOString() : null;
    setBusy(true);
    try {
      let target = selected;
      if (mode === 'new') {
        const id = await createLead({ name: nName.trim(), mobile: nPhone.trim(), source: 'Client Meeting', status: 'New', ...(nEmail.trim() ? { email: nEmail.trim() } : {}), ...((nNote.trim() || notes.trim()) ? { remark: (nNote.trim() || notes.trim()) } : {}) });
        if (!id) throw new Error('The client could not be created.');
        target = { id: String(id), name: nName.trim() };
      }
      await postMeetingRemark(target.id, { meetingType: type, outcome, remark: notes.trim(), location: location.trim() || null, followUpDate }, file);
      toast(mode === 'new' ? 'New client added and visit logged' : 'Visit logged');
      if (mode === 'new') { setSelected(target); setMode('existing'); setNName(''); setNPhone(''); setNEmail(''); setNNote(''); refresh(); } else loadPast(target.id);
      setOutcome(''); setNotes(''); setLocation(''); setFile(null); setFollowUp('');
    } catch (e) { setError(e.message || 'The visit could not be saved.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <TopBar title="Client visit log" back="/agent" />
      <div className="page">
        <p className="muted" style={{ margin: '0 2px 12px' }}>Record a field meeting or check-in.</p>

        <div className="seg" role="group" aria-label="Client">
          <button className={mode === 'existing' ? 'on' : ''} aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>Existing client</button>
          <button className={mode === 'new' ? 'on' : ''} aria-pressed={mode === 'new'} onClick={() => setMode('new')}>New client</button>
        </div>

        {mode === 'existing' ? (
          <div style={{ marginTop: 12 }}>
            {selected ? (
              <div className="fu-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b data-testid="selected-client">{selected.name}</b>
                <button className="btn ghost" onClick={() => { setSelected(null); setSearch(''); }}>Change</button>
              </div>
            ) : (
              <>
                <label className="field"><span>Client</span>
                  <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone number" aria-label="Find a client" />
                </label>
                {search.trim() && !matches.length ? <p className="small muted">No clients found.</p> : null}
                {matches.length ? (
                  <div className="pick-list" role="listbox" aria-label="Matching clients">
                    {matches.map((l) => <button key={l.id} role="option" onClick={() => { setSelected({ id: l.id, name: l.name }); setSearch(''); }}>{l.name} <span className="muted small">{l.phone}</span></button>)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <label className="field"><span>Client name *</span><input className="input" value={nName} onChange={(e) => setNName(e.target.value)} /></label>
            <label className="field"><span>Phone number *</span><input className="input" inputMode="tel" value={nPhone} onChange={(e) => setNPhone(e.target.value)} /></label>
            <label className="field"><span>Email (optional)</span><input className="input" type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} /></label>
            <label className="field"><span>Initial note / lead source (optional)</span><input className="input" value={nNote} onChange={(e) => setNNote(e.target.value)} /></label>
          </div>
        )}

        <div className="group-label">Visit type</div>
        <div className="chip-grid">{VISIT_TYPES.map((t) => <button key={t} className={`chip${type === t ? ' on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>)}</div>

        <div className="group-label">Outcome</div>
        <div className="chip-grid">{VISIT_OUTCOMES.map((o) => <button key={o} className={`chip${outcome === o ? ' on' : ''}`} aria-pressed={outcome === o} onClick={() => setOutcome(o)}>{o}</button>)}</div>

        <label className="field" style={{ marginTop: 16 }}>
          <span>Location</span>
          <div className="field-row">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Type the place, or tap Check in" />
            <button className="btn ghost" style={{ flex: '0 0 auto' }} onClick={checkIn} disabled={geoBusy} type="button"><IconPin />{geoBusy ? 'Finding…' : 'Check in'}</button>
          </div>
        </label>

        <label className="field">
          <span>Meeting notes *</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed?" maxLength={1000} />
        </label>

        <div className="field">
          <span>Photo or document (optional)</span>
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} aria-label="Take a photo" data-testid="visit-camera" />
          <input ref={fileRef} type="file" accept="image/*,application/pdf,audio/*,.doc,.docx,.xls,.xlsx" hidden onChange={pick} aria-label="Choose a file" data-testid="visit-file" />
          {file ? (
            <div className="fu-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ wordBreak: 'break-all' }}>{file.name} <span className="muted small">({(file.size / 1048576).toFixed(1)} MB)</span></span>
              <button className="btn ghost" onClick={() => setFile(null)}>Remove</button>
            </div>
          ) : (
            <div className="field-row" style={{ marginTop: 6 }}>
              <button className="btn ghost" type="button" onClick={() => camRef.current && camRef.current.click()}>Take photo</button>
              <button className="btn ghost" type="button" onClick={() => fileRef.current && fileRef.current.click()}>Attach file</button>
            </div>
          )}
        </div>

        <label className="field">
          <span>Next follow-up (optional)</span>
          <input className="input" type="datetime-local" value={followUp} min={toLocalInput(new Date())} onChange={(e) => setFollowUp(e.target.value)} />
        </label>

        {error ? <div className="alert error" role="alert" style={{ marginBottom: 12 }}>{error}</div> : null}
        <button className="btn block" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Log client visit'}</button>

        {selected ? (
          <div className="section">
            <div className="section-head"><h2>Visits with {selected.name}</h2></div>
            {past === null ? <div className="spinner" /> : past.length ? (
              <ul className="timeline">
                {past.map((m, i) => (
                  <li key={m._id || i}>
                    <div className="t-when">{fmtDate(m.createdAt || m.date)} {m.createdAt ? fmtTime(m.createdAt) : ''}</div>
                    <div className="t-what">{m.meetingType || 'Visit'} · {m.outcome}</div>
                    {m.remark ? <div className="t-note">{m.remark}</div> : null}
                    {m.location ? <div className="t-note">Location: {m.location}</div> : null}
                    {m.followUpDate ? <div className="t-note">Follow-up {fmtDate(m.followUpDate)} {fmtTime(m.followUpDate)}</div> : null}
                  </li>
                ))}
              </ul>
            ) : <div className="list empty"><b>No visits logged for this client yet</b></div>}
          </div>
        ) : null}
      </div>
    </>
  );
}
