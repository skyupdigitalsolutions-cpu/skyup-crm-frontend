import { useCallback, useEffect, useState } from 'react';
import { acceptTerms, getTerms } from '../api.js';

// Same rule as the app's TermsGate: if the company requires acceptance of the
// current terms version, block the app until the user accepts.
export default function TermsGate({ children }) {
  const [state, setState] = useState({ loading: true });
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const d = await getTerms();
      setState({ loading: false, mustAccept: !!d?.mustAccept, terms: d?.terms || null, version: d?.version ?? null });
    } catch {
      setState({ loading: false, failed: true });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (state.loading) return <div className="spinner" aria-label="Loading" />;
  if (state.failed) {
    return (
      <main className="gate">
        <h1>Can’t load the app</h1>
        <p className="lead-in">The server didn’t respond. Check your internet connection, then try again.</p>
        <button className="btn block" onClick={load}>Try again</button>
      </main>
    );
  }
  if (!state.mustAccept || !state.terms) return children;

  const t = state.terms;
  const accept = async () => {
    setBusy(true); setError('');
    try {
      await acceptTerms(state.version);
      setState((s) => ({ ...s, mustAccept: false }));
    } catch (e) {
      if (e.code === 'TERMS_VERSION_MISMATCH') { setChecked(false); load(); }
      else setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="gate" style={{ justifyContent: 'flex-start' }}>
      <h1>{t.title || 'Terms & Conditions'}</h1>
      {t.effectiveDate ? <p className="muted small" style={{ marginTop: 0 }}>Effective {t.effectiveDate}</p> : null}
      <div className="terms-body">
        {t.intro ? <p>{t.intro}</p> : null}
        {(t.sections || []).map((s, i) => (
          <p key={i}>{s.heading ? <b>{s.heading} </b> : null}{s.body || ''}</p>
        ))}
      </div>
      {error ? <div className="alert error" style={{ marginTop: 14 }}>{error}</div> : null}
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>I have read and accept these terms.</span>
      </label>
      <button className="btn block" disabled={!checked || busy} onClick={accept}>
        {busy ? 'Saving…' : 'Accept and continue'}
      </button>
    </main>
  );
}
