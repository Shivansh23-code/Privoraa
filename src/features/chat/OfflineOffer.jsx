import React from 'react';
import { X, Download, ShieldCheck, WifiOff, Boxes, Sparkles, Check } from 'lucide-react';

/**
 * "Get Privoraa Offline" — the upsell/onboarding for the private, on-device mode.
 * Cloud users (OpenRouter) can discover the offline experience here. Honest framing:
 * powered by open-source models run locally via Ollama; the paid value is Privoraa's
 * curated catalog, UI, RAG and future plans — not the open-source engine itself.
 */
export default function OfflineOffer({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-line px-6 py-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/15 via-transparent to-accent-500/15" />
          <button
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} />
          </button>
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-2.5 py-1 text-[11px] font-semibold text-brand-400">
            <Sparkles size={12} /> Free while in beta
          </span>
          <h2 className="relative mt-2 font-display text-xl font-bold">Privoraa Offline</h2>
          <p className="relative mt-1 text-sm text-muted">
            Run AI privately on your own machine. Nothing leaves your device — no cloud, no API
            keys, no per-message cost.
          </p>
        </div>

        {/* Body */}
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Feature icon={ShieldCheck} title="100% private" body="Your chats and documents never leave your computer." />
            <Feature icon={WifiOff} title="Works offline" body="Download a model once, then use it with no internet." />
            <Feature icon={Boxes} title="Curated catalog" body="Pick models by use case — coding, reasoning, vision, more." />
            <Feature icon={Sparkles} title="Free now" body="Paid plans (bigger models, teams, priority) coming soon." />
          </div>

          <div className="mt-5 rounded-xl border border-line bg-surface p-4">
            <p className="mb-2 text-sm font-semibold">Get started in 3 steps</p>
            <ol className="space-y-2 text-sm text-muted">
              <li className="flex gap-2">
                <span className="font-semibold text-brand-500">1.</span>
                Download the free offline engine.
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-brand-500">2.</span>
                Open Privoraa locally and pick a model from the catalog —
                <span className="text-fg/80"> one click to download it.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-brand-500">3.</span>
                Chat &amp; ground answers on your notes, fully offline.
              </li>
            </ol>
          </div>

          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
          >
            <Download size={17} /> Download the offline engine
          </a>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-faint">
            <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
            Powered by open-source models (Llama, Qwen, Gemma, DeepSeek…) run locally via the
            open-source Ollama runtime. Privoraa curates and manages them for you — it does not
            host or resell the model weights. You own your data.
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <Icon size={18} className="mb-1.5 text-brand-400" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted">{body}</p>
    </div>
  );
}
