import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err.status === 401 || err.status === 400 || err.status === 403 ? (err.message || 'Email or password is incorrect.') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="gate">
      <div className="brand">
        <img src="/agent-icons/icon-192.png" alt="" />
        <b>SkyUp CRM</b>
      </div>
      <h1>Sign in</h1>
      <p className="lead-in">Use the same email and password as the SkyUp CRM app.</p>
      <p className="muted small" style={{ margin: '-16px 0 22px' }}>You stay signed in on this phone until you sign out.</p>
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" inputMode="email" autoComplete="username"
            autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn block" type="submit" disabled={busy} style={{ marginTop: 8 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <a href="/agent/forgot-password" className="small" style={{ display: 'block', textAlign: 'center', marginTop: 18, fontWeight: 600 }}>
        Forgot password?
      </a>
    </main>
  );
}
