import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Download, ShieldCheck, WifiOff, Cpu, Check, Copy, ArrowRight,
} from 'lucide-react';

/**
 * Vedix-branded download page. We keep users on our own pages rather than
 * sending them straight to the source; the actual installer link points at the
 * open-source engine, framed honestly as the free engine Vedix provides.
 * Also documents the OLLAMA_ORIGINS step that lets the browser talk to a local
 * Ollama from the production site.
 */
const ENGINE_URL = 'https://ollama.com/download'; // the open-source engine we bundle the experience around
const ORIGIN_CMD = 'OLLAMA_ORIGINS=https://vedix.vercel.app ollama serve';

export default function DownloadPage() {
  const [copied, setCopied] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ORIGIN_CMD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-fg">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white">
            <Sparkles size={16} />
          </span>
          Vedix
        </Link>
        <Link to="/app" className="text-sm font-medium text-muted transition hover:text-fg">
          Open the app →
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-3xl px-5 pt-8 text-center sm:pt-12">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
          <WifiOff size={12} className="text-brand-400" /> Vedix Offline · free
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
          Run AI privately on your device
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
          Download the free offline engine once. Then Vedix runs models entirely on your
          machine — already have it? The app uses it automatically, no re-download.
        </p>
      </div>

      {/* Feature row */}
      <div className="relative z-10 mx-auto mt-8 grid max-w-4xl gap-3 px-5 sm:grid-cols-3">
        <Feature icon={ShieldCheck} title="100% private" body="Chats and documents never leave your computer." />
        <Feature icon={WifiOff} title="Works offline" body="Download a model once, then use it with no internet." />
        <Feature icon={Cpu} title="Already installed?" body="Vedix detects your Ollama and just uses it." />
      </div>

      {/* Steps */}
      <div className="relative z-10 mx-auto mt-10 max-w-2xl px-5 pb-20">
        <Step n="1" title="Get the free offline engine">
          <p className="text-sm text-muted">
            Vedix Offline is powered by the open-source Ollama runtime — we provide it free.
          </p>
          <a
            href={ENGINE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
          >
            <Download size={16} /> Download the engine
          </a>
        </Step>

        <Step n="2" title="Let Vedix connect to it">
          <p className="text-sm text-muted">
            So the website can use your local models, start the engine allowing this site:
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs">
            <span className="flex-1 truncate text-fg/90">{ORIGIN_CMD}</span>
            <button onClick={copy} title="Copy" className="shrink-0 text-muted hover:text-fg">
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="mt-2 text-xs text-faint">
            (Or set <code className="rounded bg-surface-2 px-1">OLLAMA_ORIGINS</code> in your system
            environment. Using the desktop app instead? You can skip this.)
          </p>
        </Step>

        <Step n="3" title="Pick a model and chat" last>
          <p className="text-sm text-muted">
            Open Vedix, choose <span className="text-fg/90">Offline</span> in the model picker,
            and select a model. Already downloaded? It shows <span className="text-fg/90">“On your
            device — ready”</span> and runs instantly.
          </p>
          <Link
            to="/app"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm font-semibold transition hover:border-brand-400"
          >
            Open Vedix <ArrowRight size={16} />
          </Link>
        </Step>

        <p className="mt-8 text-center text-[11px] leading-relaxed text-faint">
          Powered by open-source models (Llama, Qwen, Gemma, DeepSeek…) run locally via the
          open-source Ollama runtime. Vedix curates and manages them for you — free, public,
          and private. You own your data.
        </p>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <Icon size={18} className="mb-1.5 text-brand-400" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted">{body}</p>
    </div>
  );
}

function Step({ n, title, children, last }) {
  return (
    <div className={`flex gap-4 ${last ? '' : 'pb-6'}`}>
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-400">
          {n}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-line" />}
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
