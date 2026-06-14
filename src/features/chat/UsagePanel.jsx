import React, { useMemo } from 'react';
import { Activity, Coins, MessagesSquare } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

// Rough cost estimate purely for the dashboard feel; the backend will return the
// real figure from OpenRouter's generation endpoint.
const COST_PER_1K = 0; // free models

export default function UsagePanel({ hideHeading = false }) {
  const conversations = useChatStore((s) => s.conversations);

  const stats = useMemo(() => {
    let requests = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    const byModel = {};

    for (const c of conversations) {
      for (const m of c.messages) {
        if (m.role !== 'assistant') continue;
        requests += 1;
        promptTokens += m.promptTokens || 0;
        completionTokens += m.completionTokens || 0;
        const key = m.model || 'Unknown';
        byModel[key] = (byModel[key] || 0) + (m.completionTokens || 0);
      }
    }
    const totalTokens = promptTokens + completionTokens;
    const top = Object.entries(byModel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const max = top[0]?.[1] || 1;
    return { requests, totalTokens, top, max, cost: (totalTokens / 1000) * COST_PER_1K };
  }, [conversations]);

  return (
    <div className="flex flex-col gap-2">
      {!hideHeading && (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Usage</h3>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={MessagesSquare} value={stats.requests} label="Requests" />
        <Stat icon={Activity} value={fmt(stats.totalTokens)} label="Tokens" />
        <Stat icon={Coins} value={stats.cost ? `$${stats.cost.toFixed(2)}` : 'Free'} label="Est. cost" />
      </div>

      {stats.top.length > 0 && (
        <div className="mt-1 rounded-lg border border-line bg-surface p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Model mix
          </p>
          <div className="flex flex-col gap-2">
            {stats.top.map(([name, tokens]) => (
              <div key={name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate text-fg/80">{name}</span>
                  <span className="text-faint">{fmt(tokens)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                    style={{ width: `${Math.max(6, (tokens / stats.max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label }) {
  const Icon = icon;
  return (
    <div className="rounded-lg border border-line bg-surface p-2.5 text-center">
      <Icon size={15} className="mx-auto mb-1 text-brand-400" />
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-faint">{label}</div>
    </div>
  );
}

function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
