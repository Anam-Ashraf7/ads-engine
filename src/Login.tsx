// The login. The server checks the password and sets a cookie the page can't read; every /api request needs that cookie.
// The note in localStorage only decides whether "/" opens the app or the public home page. It unlocks nothing.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { BrandMark } from './icons';

const KEY = 'ae.signedIn';

export function isSignedIn() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* private window: "/" shows the home page, and the Log in link still works */
  }
}

export async function signOut() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch {
    /* no connection: the note below is still cleared, and the cookie runs out by itself */
  }
  remember(false);
  location.assign('/');
}

/** The server said this browser isn't logged in. */
export function sessionEnded() {
  remember(false);
  if (location.pathname !== '/login') location.assign('/login');
}

async function askSession(): Promise<boolean> {
  try {
    const r = await fetch('/api/session');
    return !!(await r.json()).signedIn;
  } catch {
    // Vite with no API server behind it, showing sample data only. A built site never takes this path.
    return import.meta.env.DEV;
  }
}

export function LoginGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    askSession().then((on) => {
      remember(on);
      // The note was out of date: the session ran out, so "/" goes back to the public home page.
      if (!on && location.pathname === '/') location.reload();
      else setSignedIn(on);
    });
  }, []);

  if (signedIn === null) return null;
  if (signedIn) return pathname === '/login' ? <Navigate to="/" replace /> : <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) });
      const out = await r.json();
      if (r.ok && out.ok) {
        remember(true);
        setSignedIn(true);
      } else {
        setError(out.summary ?? 'Could not log in.');
      }
    } catch {
      setError("Can't reach the server. Try again in a minute.");
    }
    setSending(false);
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <BrandMark />
          <span>Ads engine</span>
        </div>
        <h1>Log in</h1>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary login-submit" type="submit" disabled={sending}>
          {sending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
