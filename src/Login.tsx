// PROTOTYPE: one fixed demo login, checked in the browser. It keeps casual visitors out of a demo; it is not real security.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { BrandMark } from './icons';

const DEMO_NAME = 'admin';
const DEMO_PASSWORD = 'work';
const KEY = 'ae.signedIn';

export function isSignedIn() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing saved, so the reload below still shows the login */
  }
  location.reload();
}

export function LoginGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [signedIn, setSignedIn] = useState(isSignedIn);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  if (signedIn) return pathname === '/login' ? <Navigate to="/" replace /> : <>{children}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().toLowerCase() !== DEMO_NAME || password !== DEMO_PASSWORD) {
      setError(true);
      return;
    }
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* private window: stays signed in until the page reloads */
    }
    setSignedIn(true);
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
            That name or password is wrong.
          </p>
        )}
        <button className="btn primary login-submit" type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}
