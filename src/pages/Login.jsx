import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useUserAuth } from '../context/UserAuthContext';

const Login = () => {
  const { login } = useUserAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch {
      setError('Login failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 py-10 text-fg">
      {/* Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-brand-600/25 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-accent-500/10 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/35 to-brand-500/50"
      />

      {/* Back to home */}
      <Link
        to="/"
        className="relative mb-6 inline-flex items-center gap-2 text-sm text-muted transition hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to home
      </Link>

      {/* Brand */}
      <Link to="/" className="relative mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-brand-600">
          <img src="/logo.png" alt="Vedix" />
        </span>
        <span className="font-display text-lg font-bold">Vedix</span>
      </Link>

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-[0_34px_80px_-24px_rgba(0,0,0,.75)]">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-500">
          Welcome back
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight">Open your workspace.</h1>
        <p className="mt-2 text-sm text-muted">Log in to continue where you left off.</p>

        <form className="mt-7 space-y-4" onSubmit={handleLogin}>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg placeholder:text-faint transition focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/15"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-fg placeholder:text-faint transition focus:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition hover:text-fg"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[#FF7A93]/30 bg-[#FF7A93]/10 px-3 py-2 text-sm text-[#FF7A93]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(106,90,232,.4)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(106,90,232,.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New to Vedix?{' '}
          <Link to="/signup" className="font-semibold text-accent-500 hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <p className="relative mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        Sealed sessions · You hold the key
      </p>
    </div>
  );
};

export default Login;
