// Subscription plans — the single source of truth for tier metadata, ordering,
// and entitlement checks across the Plans page, the model catalog, and the chat
// header. Mirrors the backend Plan enum (FREE < PLUS < PRO).

export const PLAN_RANK = { FREE: 0, PLUS: 1, PRO: 2 };

/** True if a user on `userPlan` is entitled to something requiring `requiredPlan`. */
export function planAllows(userPlan, requiredPlan) {
  const u = PLAN_RANK[(userPlan || 'FREE').toUpperCase()] ?? 0;
  const r = PLAN_RANK[(requiredPlan || 'FREE').toUpperCase()] ?? 0;
  return u >= r;
}

export function planLabel(plan) {
  const p = (plan || 'FREE').toUpperCase();
  return p.charAt(0) + p.slice(1).toLowerCase(); // FREE -> Free
}

// Per-plan visual theme — richer chrome for higher tiers. `iconKey` is resolved
// to a lucide icon by the consumer. Used by the chat header (chip, avatar ring,
// accent bar) so the UI visibly reflects the user's plan.
export const PLAN_THEME = {
  FREE: {
    label: 'Free',
    iconKey: 'gem',
    chip: 'border-line bg-surface text-muted hover:border-brand-400 hover:text-fg',
    ring: 'from-brand-500 to-accent-500',
    accent: 'from-transparent via-line to-transparent',
  },
  PLUS: {
    label: 'Plus',
    iconKey: 'zap',
    chip: 'border-brand-400/50 bg-brand-500/10 text-brand-500',
    ring: 'from-brand-500 to-accent-500',
    accent: 'from-brand-500/50 via-accent-500/40 to-transparent',
  },
  PRO: {
    label: 'Pro',
    iconKey: 'crown',
    chip: 'border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-500',
    ring: 'from-amber-400 to-orange-500',
    accent: 'from-amber-400/60 via-orange-500/40 to-transparent',
  },
};

export const planTheme = (plan) => PLAN_THEME[(plan || 'FREE').toUpperCase()] || PLAN_THEME.FREE;

// Marketing/selection content for the Plans page. Paid tiers are "coming soon"
// until billing is wired — they currently onboard as Free.
export const PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Everything you need to start — fully private.',
    accent: 'from-slate-500/20 to-slate-400/10',
    cta: 'Start free',
    available: true,
    features: [
      'Online chat on curated free models',
      'Smart Auto model routing',
      'Document chat (RAG) on your notes',
      'Offline starter models (run on your device)',
      'Encrypted, on-device memory',
    ],
  },
  {
    key: 'PLUS',
    name: 'Plus',
    price: 'Coming soon',
    period: '',
    tagline: 'For everyday power users who want more.',
    accent: 'from-brand-500/25 to-accent-500/15',
    cta: 'Join the waitlist',
    available: false,
    popular: true,
    features: [
      'Everything in Free',
      'Coding, reasoning & vision models',
      'Larger offline models (up to 7B)',
      'Priority routing & higher limits',
      'Multi-format document support',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: 'Coming soon',
    period: '',
    tagline: 'The biggest models and the best quality.',
    accent: 'from-amber-500/25 to-orange-500/10',
    cta: 'Join the waitlist',
    available: false,
    features: [
      'Everything in Plus',
      'Top-tier 7B+ offline models',
      'Every category unlocked',
      'Early access to new models',
      'Priority support',
    ],
  },
];
