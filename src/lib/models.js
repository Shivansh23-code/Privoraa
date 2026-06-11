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
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B',
    shortName: 'GPT-OSS 120B',
    description: 'Strong general-purpose reasoning.',
    category: 'general',
    contextLength: 131000,
    isFree: true,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B',
    shortName: 'GPT-OSS 20B',
    description: 'Fast, low-latency responses.',
    category: 'fast',
    contextLength: 131000,
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
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B',
    shortName: 'Gemma 4 31B',
    description: 'Capable general-purpose chat.',
    category: 'general',
    contextLength: 131000,
    isFree: true,
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    name: 'Qwen3 Next 80B',
    shortName: 'Qwen3 Next 80B',
    description: 'Large multilingual model.',
    category: 'multilingual',
    contextLength: 262000,
    isFree: true,
  },
];

// Category → preferred model (mirrors the backend router defaults).
export const ROUTER_DEFAULTS = {
  code: 'qwen/qwen3-coder:free',
  reasoning: 'openai/gpt-oss-120b:free',
  math: 'openai/gpt-oss-120b:free',
  general: 'openai/gpt-oss-120b:free',
  fast: 'openai/gpt-oss-20b:free',
  multilingual: 'qwen/qwen3-next-80b-a3b-instruct:free',
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
