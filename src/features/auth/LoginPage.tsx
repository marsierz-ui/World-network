import { useState } from 'react';
import { useAuth } from './authContext';

export function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn = mode === 'in' ? signInWithEmail : signUpWithEmail;
    const { error } = await fn(email, password);
    setError(error);
    setBusy(false);
  }

  return (
    <div className="login">
      <h1>World Network</h1>
      <p className="muted">Your network, on the map.</p>
      <p className="muted small">
        Place your contacts on a world map and keep them in sync with Google Contacts. If you
        sign in with Google, the app asks to read and update your contacts for that purpose
        only.
      </p>

      <button className="btn-google" onClick={signInWithGoogle}>
        Continue with Google
      </button>

      <div className="divider">or</div>

      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
        {mode === 'in' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>

      <p className="muted small">
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>Privacy Policy</a>
        {' | '}
        <a href={`${import.meta.env.BASE_URL}terms.html`}>Terms of Service</a>
      </p>
    </div>
  );
}
