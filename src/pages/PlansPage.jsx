import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ArrowRight, Star, Loader2, Sparkles } from 'lucide-react';
import { useUserAuth } from '../context/UserAuthContext';
import { PLANS } from '../lib/plans';
import { startUpgrade, fetchBillingConfig } from '../lib/billingService';

/**
 * Public Plans page — the funnel between the marketing site and the app.
 * "Launch app" / "Get early access" land here; choosing a plan routes the user
 * into the chat (signing up first if needed). Full-screen standalone layout.
 */
export default function PlansPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, updateProfile } = useUserAuth();
  const [busy, setBusy] = useState(null); // plan key being processed
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null); // billing config: prices + currency

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchBillingConfig().then(setConfig).catch(() => {});
  }, []);

  // Real price from config when a paid amount is set; else the static label.
  const priceFor = (p) => {
    const info = config?.plans?.find((x) => x.plan === p.key);
    if (info && info.amount > 0) {
      const cur = (config.currency || 'INR').toUpperCase();
      const sym = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : `${cur} `;
      return `${sym}${info.amount / 100}`;
    }
    return p.price;
  };

  const choose = async (planKey) => {
    setError(null);
    // Free, or not signed in yet -> straight into the app / signup.
    if (planKey === 'FREE') {
      navigate(isAuthenticated ? '/app' : '/signup');
      return;
    }
    if (!isAuthenticated) {
      navigate('/signup');
      return;
    }
    // Paid plan: run the upgrade (free-beta grant or Razorpay Checkout).
    setBusy(planKey);
    try {
      const newPlan = await startUpgrade(planKey, user);
      updateProfile({ plan: (newPlan || planKey).toUpperCase() });
      navigate('/app');
    } catch (e) {
      if (e?.message !== 'Payment cancelled.') setError(e.message || 'Upgrade failed.');
    } finally {
      setBusy(null);
    }
  };

  const currentPlan = (user?.plan || '').toUpperCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-fg">
      {/* Ambient glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-accent-500/10 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white">
            <Sparkles size={16} />
          </span>
          Privoraa
        </Link>
        <Link to="/app" className="text-sm font-medium text-muted transition hover:text-fg">
          Skip to app →
        </Link>
      </header>

      {/* Hero */}
      <div className="relative z-10 mx-auto max-w-3xl px-5 pt-8 text-center sm:pt-14">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
          <Star size={12} className="text-brand-400" /> Simple pricing · Free while in beta
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Choose your plan
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
          Private AI that runs your way — in the cloud or fully on your device. Start free; upgrade
          when you need bigger models and more power.
        </p>
      </div>

      {error && (
        <div className="relative z-10 mx-auto mt-6 max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Cards */}
      <div className="relative z-10 mx-auto grid max-w-6xl gap-5 px-5 pb-20 pt-10 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = isAuthenticated && currentPlan === p.key;
          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl border bg-surface/80 p-6 backdrop-blur transition ${
                p.popular ? 'border-brand-400 shadow-xl shadow-brand-500/10 md:-translate-y-3' : 'border-line'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-3 py-1 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              )}

              <div className={`mb-4 rounded-xl bg-gradient-to-br ${p.accent} p-4`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  {isCurrent && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold">
                  {priceFor(p)}
                  {p.period && <span className="ml-1 text-sm font-normal text-muted">/ {p.period}</span>}
                </p>
                <p className="mt-1 text-xs text-muted">{p.tagline}</p>
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-fg/90">{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => choose(p.key)}
                disabled={busy === p.key}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-60 ${
                  p.popular
                    ? 'bg-gradient-to-r from-brand-600 to-accent-500 text-white hover:opacity-95'
                    : 'border border-line bg-surface-2 text-fg hover:border-brand-400'
                }`}
              >
                {busy === p.key ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {isCurrent ? 'Continue' : p.cta}
              </button>
            </div>
          );
        })}
      </div>

      <p className="relative z-10 pb-10 text-center text-xs text-faint">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
