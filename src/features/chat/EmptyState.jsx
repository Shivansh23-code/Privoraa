import React from 'react';
import { Sparkles } from 'lucide-react';
import { getMode } from '../../lib/modes';

const SUGGESTIONS = {
  general: [
    'Explain how JWT authentication works',
    'Draft a polite follow-up email to a recruiter',
    'Summarize the key ideas of system design',
    'Give me 5 ideas for a weekend project',
  ],
  exam_tutor: [
    'Explain Bayes’ theorem with a worked example',
    "Teach me integration by parts step by step",
    'Quiz me on data structures (5 questions)',
    'What’s the intuition behind eigenvalues?',
  ],
  code_mentor: [
    'Review this function for edge cases',
    'Refactor a callback into async/await',
    'Explain time complexity of quicksort',
    'Write a debounce hook in React',
  ],
  math_solver: [
    'Solve ∫₀¹ x·eˣ dx step by step',
    'Prove the sum of first n odd numbers is n²',
    'Find the roots of x² − 5x + 6 = 0',
    'Differentiate sin(x²) and verify',
  ],
  interview_prep: [
    'Ask me a system design question',
    'Give me a behavioral interview question',
    'Quiz me on SQL joins',
    'Mock a Spring Boot technical round',
  ],
  explain_simply: [
    'Explain recursion like I’m five',
    'What is a hash map, simply?',
    'How does HTTPS keep data safe?',
    'Explain Big-O with an analogy',
  ],
};

export default function EmptyState({ mode, onPick }) {
  const m = getMode(mode);
  const Icon = m.icon || Sparkles;
  const suggestions = SUGGESTIONS[mode] || SUGGESTIONS.general;

  return (
    <div className="mx-auto flex min-h-full max-w-[760px] flex-col items-center justify-center px-4 pb-[calc(var(--composer-height,9rem)+2rem)] pt-10 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-[var(--accent-primary)] ring-1 ring-line shadow-xl">
        <Icon size={26} />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">How can I help?</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        {m.description}
      </p>

      <div className="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="control-surface min-h-14 rounded-2xl px-4 py-3 text-left text-sm leading-5 text-fg/90 transition hover:-translate-y-0.5"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Signature motto */}
      <div className="mt-9 flex items-center gap-3 text-faint">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-line" />
        <p className="bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-xs font-semibold italic tracking-wide text-transparent">
          Your confidence decides who you are.
        </p>
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-line" />
      </div>
    </div>
  );
}
