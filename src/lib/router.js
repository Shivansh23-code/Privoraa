// Client-side mirror of the backend "Deep Route" Tier-1 heuristics (spec §7.5).
// The authoritative routing happens server-side; this is used to (a) preview the
// likely model in the UI and (b) drive model selection in local mock mode.

import { ROUTER_DEFAULTS } from './models';

const CODE_RE =
  /```|\b(bug|stack trace|stacktrace|compile|function|class|regex|sql|exception|null ?pointer|segfault|refactor|typescript|java|python|c\+\+|async|api endpoint)\b/i;
const MATH_RE =
  /[∫∑√≤≥≠π∞∂]|\\frac|\\sqrt|\\int|\$\$|\b(solve|prove|derivative|integral|probability|equation|theorem|step by step|matrix|differentiate|integrate)\b/i;
// Non-Latin scripts (Cyrillic, Arabic, Devanagari, CJK, Japanese kana).
const MULTILINGUAL_RE =
  /\p{Script=Cyrillic}|\p{Script=Arabic}|\p{Script=Devanagari}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u;

/**
 * Classify a user message into a routing category.
 * @returns {{category: string, reason: string}}
 */
export function classifyIntent(text, { mode, useRag } = {}) {
  const t = text || '';

  // Mode can hard-bias the category.
  if (mode === 'code_mentor') return { category: 'code', reason: 'Code Mentor mode' };
  if (mode === 'math_solver') return { category: 'math', reason: 'Math Solver mode' };
  if (mode === 'exam_tutor') return { category: 'reasoning', reason: 'Exam Tutor mode' };

  if (useRag) return { category: 'general', reason: 'Grounded on your notes' };
  if (CODE_RE.test(t)) return { category: 'code', reason: 'Looks like a coding question' };
  if (MATH_RE.test(t)) return { category: 'reasoning', reason: 'Looks like math / reasoning' };
  if (MULTILINGUAL_RE.test(t))
    return { category: 'multilingual', reason: 'Non-Latin script detected' };
  if (t.length < 80) return { category: 'fast', reason: 'Short prompt — optimizing for speed' };
  return { category: 'general', reason: 'General conversation' };
}

/** Resolve the category to a concrete model id from the live catalog (with fallback). */
export function routeModel(text, opts, catalog = []) {
  const { category, reason } = classifyIntent(text, opts);
  const preferredId = ROUTER_DEFAULTS[category] || ROUTER_DEFAULTS.general;
  const hit =
    catalog.find((m) => m.id === preferredId) ||
    catalog.find((m) => m.category === category) ||
    null;
  return { category, reason, modelId: hit?.id || preferredId };
}
