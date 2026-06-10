// Model catalog. The live list comes from the backend (`GET /models`, which
// caches OpenRouter's free roster). This static list is a fallback so the UI is
// fully usable before the backend exists, and seeds the "Auto" router defaults.
//
// The free roster shifts monthly — never treat this as the source of truth.

export const AUTO_MODEL = {
  id: 'auto',
  name: 'Auto',
  shortName: 'Auto',
  description: 'Smart route — picks the best free model for each question.',
  category: 'auto',
  contextLength: null,
  isFree: true,
};

export const FALLBACK_MODELS = [
  {
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1',
    shortName: 'DeepSeek R1',
    description: 'Reasoning & math — slow but rigorous.',
    category: 'reasoning',
    contextLength: 64000,
    isFree: true,
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen3 Coder',
    shortName: 'Qwen3 Coder',
    description: 'Code generation, review and debugging.',
    category: 'code',
    contextLength: 256000,
    isFree: true,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B',
    shortName: 'Llama 3.3',
    description: 'Strong general-purpose chat.',
    category: 'general',
    contextLength: 128000,
    isFree: true,
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    shortName: 'Gemini Flash',
    description: 'Fast, multimodal, low latency.',
    category: 'fast',
    contextLength: 1000000,
    isFree: true,
  },
  {
    id: 'qwen/qwen3-235b-a22b:free',
    name: 'Qwen3 235B',
    shortName: 'Qwen3 235B',
    description: 'Large multilingual model.',
    category: 'multilingual',
    contextLength: 128000,
    isFree: true,
  },
];

// Category → ordered fallback chain (matches the backend router defaults).
export const ROUTER_DEFAULTS = {
  code: 'qwen/qwen3-coder:free',
  reasoning: 'deepseek/deepseek-r1:free',
  math: 'deepseek/deepseek-r1:free',
  general: 'meta-llama/llama-3.3-70b-instruct:free',
  fast: 'google/gemini-2.0-flash-exp:free',
  multilingual: 'qwen/qwen3-235b-a22b:free',
};

export const CATEGORY_LABELS = {
  auto: 'Smart route',
  reasoning: 'Reasoning',
  code: 'Code',
  general: 'General',
  fast: 'Fast',
  multilingual: 'Multilingual',
};

export function findModel(models, id) {
  if (id === 'auto' || !id) return AUTO_MODEL;
  return models.find((m) => m.id === id) || AUTO_MODEL;
}
