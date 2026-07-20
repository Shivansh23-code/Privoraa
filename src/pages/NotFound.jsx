import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 text-center text-fg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-brand-600/25 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/35 to-brand-500/50"
      />

      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-500 to-brand-600 shadow-[0_6px_18px_rgba(43,224,190,.25)]">
        <img src="/logo.png" alt="Vedix" />
      </span>
      <p className="relative mt-6 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent-500">
        Error 404
      </p>
      <h1 className="relative mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
        This page doesn't exist.
      </h1>
      <p className="relative mt-3 max-w-md text-muted">
        The page you're looking for was moved, renamed, or never existed.
      </p>
      <Link
        to="/"
        className="relative mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-600 to-brand-500 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(106,90,232,.4)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to home
      </Link>
      <p className="relative mt-8 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        Sealed sessions · You hold the key
      </p>
    </div>
  );
}
