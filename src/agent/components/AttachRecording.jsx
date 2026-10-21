// src/agent/components/AttachRecording.jsx
// "Attach call recording" — manual upload for phones that cannot sync call recordings (iPhone). See recordingUpload.js.
import { useEffect, useRef, useState } from 'react';
import { uploadRecording } from '../api.js';
import {
  ACCEPT, buildRecordingForm, defaultCallTime, describeUploadError, fmtDuration, fmtSize, fromLocalInput,
  phone10, readDurationSec, toLocalInput, validateRecordingFile,
} from '../recordingUpload.js';
import { IconMic } from './icons.jsx';

export default function AttachRecording({ lead, onAttached }) {
  const inputRef = useRef(null);
  const alive = useRef(true);
  const pickToken = useRef(0);
  const [step, setStep] = useState('idle');       // idle | picked | uploading | done
  const [file, setFile] = useState(null);
  const [when, setWhen] = useState('');
  const [maxWhen, setMaxWhen] = useState('');     // latest allowed call time, fixed when the file is picked
  const [note, setNote] = useState('');
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');       // attached | duplicate

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const usable = !!lead && !!lead.id && !!phone10(lead.phone);
  const busy = step === 'uploading';

  const reset = () => {
    pickToken.current += 1;
    setStep('idle'); setFile(null); setWhen(''); setMaxWhen(''); setNote(''); setSecs(0); setError(''); setResult('');
  };

  const onPick = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';                            // so the same file can be chosen again after a Cancel
    if (!f) return;
    const v = validateRecordingFile(f);
    if (!v.ok) { setError(v.message); setStep('idle'); return; }
    const token = ++pickToken.current;
    setError(''); setFile(f); setWhen(toLocalInput(defaultCallTime(f))); setMaxWhen(toLocalInput(Date.now() + 60000)); setSecs(0); setStep('picked');
    readDurationSec(f).then((s) => { if (alive.current && token === pickToken.current) setSecs(s); });
  };

  const send = async () => {
    const callTimeMs = fromLocalInput(when);
    if (!Number.isFinite(callTimeMs)) { setError('Choose when the call happened.'); return; }
    if (callTimeMs > Date.now() + 5 * 60000) { setError('The call time cannot be in the future.'); return; }
    setError(''); setStep('uploading');
    try {
      const res = await uploadRecording(buildRecordingForm({ lead, file, callTimeMs, durationSec: secs, remark: note }));
      if (!alive.current) return;
      const dup = !!(res && res.duplicate);
      setResult(dup ? 'duplicate' : 'attached'); setStep('done');
      if (!dup && onAttached) onAttached(res);
    } catch (err) {
      if (!alive.current) return;
      setError(describeUploadError(err)); setStep('picked');
    }
  };

  return (
    <div className="attach">
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={onPick}
        data-testid="recording-input" aria-label="Choose a call recording file" />

      {step === 'idle' && (
        <>
          <button className="btn block ghost" onClick={() => inputRef.current && inputRef.current.click()} disabled={!usable}>
            <IconMic />Attach call recording
          </button>
          {usable
            ? <p className="muted hint">iPhone: after the call open Notes, then Call Recordings, tap More, Save Audio Files, then choose the file here.</p>
            : <p className="muted hint">This lead needs a valid phone number before a recording can be attached.</p>}
          {error ? <p className="attach-error" role="alert" style={{ marginTop: 10 }}>{error}</p> : null}
        </>
      )}

      {(step === 'picked' || step === 'uploading') && file && (
        <div className="attach-card">
          <div className="attach-file">
            <b>{file.name}</b>
            <span className="muted small">{fmtSize(file.size)}{secs ? ` · ${fmtDuration(secs)}` : ''}</span>
          </div>
          <label className="field">
            <span>When was the call?</span>
            <input className="input" type="datetime-local" value={when} max={maxWhen || undefined}
              onChange={(e) => setWhen(e.target.value)} disabled={busy} />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <textarea className="textarea" rows={2} maxLength={500} value={note}
              onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="Anything to remember from this call" />
          </label>
          {error ? <p className="attach-error" role="alert">{error}</p> : null}
          {busy ? <p className="muted small" role="status" style={{ margin: '0 0 12px' }}>Keep this screen open until it finishes. A long recording can take a minute.</p> : null}
          <div className="attach-actions">
            <button className="btn green" onClick={send} disabled={busy}>{busy ? 'Uploading…' : 'Upload recording'}</button>
            <button className="btn ghost" onClick={reset} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="attach-card attach-done" role="status">
          <b>{result === 'duplicate' ? 'This recording was already attached.' : 'Recording attached.'}</b>
          <span className="muted small">
            {result === 'duplicate' ? 'Nothing was uploaded twice.' : `It is saved with ${lead.name}'s calls and can be transcribed from the CRM.`}
          </span>
          <button className="btn block ghost" onClick={reset}>Attach another</button>
        </div>
      )}
    </div>
  );
}
