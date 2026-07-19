import React, { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy, WrapText } from 'lucide-react';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

function nodeToText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (node.props && node.props.children) return nodeToText(node.props.children);
  return '';
}

function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState(false);
  const [wrapped, setWrapped] = useState(false);
  const lang = /language-(\w+)/.exec(className || '')?.[1] || 'text';
  const code = nodeToText(children).replace(/\n$/, '');

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }, [code]);

  return (
    <div className="group/code my-5 overflow-hidden rounded-xl border border-line/80 bg-[#08090b] shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line/60 bg-[#0c0d10] px-4 py-2">
        <span className="font-mono text-[11px] font-medium tracking-wide text-accent-500/80 uppercase">{lang}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWrapped((w) => !w)}
            aria-label={wrapped ? 'Disable word wrap' : 'Enable word wrap'}
            className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition ${
              wrapped ? 'text-accent-400 bg-white/8' : 'text-muted hover:text-fg hover:bg-white/5'
            }`}
          >
            <WrapText size={13} />
          </button>
          <button
            onClick={copy}
            aria-label={`Copy ${lang} code`}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted transition hover:bg-white/5 hover:text-fg"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className={`scroll-thin overflow-x-auto p-4 text-[13.5px] leading-relaxed ${wrapped ? 'whitespace-pre-wrap break-all' : ''}`}>
        <code className={`${className || ''} bg-transparent`}>{children}</code>
      </pre>
    </div>
  );
}

const CALLOUT_PATTERNS = [
  { re: /^Tip/i, border: 'border-emerald-500', bg: 'bg-emerald-500/6', icon: '💡' },
  { re: /^Warning/i, border: 'border-amber-500', bg: 'bg-amber-500/6', icon: '⚠️' },
  { re: /^Important/i, border: 'border-violet-500', bg: 'bg-violet-500/6', icon: '🔶' },
  { re: /^Note/i, border: 'border-blue-500', bg: 'bg-blue-500/6', icon: '📌' },
  { re: /^Info/i, border: 'border-sky-500', bg: 'bg-sky-500/6', icon: 'ℹ️' },
  { re: /^Success/i, border: 'border-emerald-500', bg: 'bg-emerald-500/6', icon: '✅' },
  { re: /^Error|^Danger/i, border: 'border-red-500', bg: 'bg-red-500/6', icon: '❌' },
];

function detectCallout(children) {
  const text = nodeToText(children);
  for (const c of CALLOUT_PATTERNS) {
    if (c.re.test(text)) return c;
  }
  return null;
}

const components = {
  pre: ({ children }) => <>{children}</>,
  code({ className, children }) {
    const text = nodeToText(children);
    const isBlock = /language-/.test(className || '') || text.includes('\n');
    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    return (
      <code className="rounded-md border border-line/50 bg-surface-2/70 px-[5px] py-[1.5px] font-mono text-[.85em] text-brand-600 dark:text-brand-300">
        {children}
      </code>
    );
  },
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-600 underline decoration-brand-300/50 underline-offset-2 transition-colors hover:decoration-brand-500 dark:text-brand-300"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="scroll-thin my-5 overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-line bg-surface-2 px-3 py-2.5 text-left font-semibold text-fg/90">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-line px-3 py-2.5 text-fg/80">{children}</td>,
  blockquote({ children }) {
    const callout = detectCallout(children);
    if (callout) {
      return (
        <blockquote className={`my-5 overflow-hidden rounded-xl border-l-[3px] ${callout.border} ${callout.bg} py-3 pl-4 pr-4 text-muted`}>
          {children}
        </blockquote>
      );
    }
    return (
      <blockquote className="my-5 border-l-[3px] border-[var(--accent-primary)] bg-surface-2/40 py-2 pl-5 pr-4 text-muted">
        {children}
      </blockquote>
    );
  },
  input(props) {
    // eslint-disable-next-line no-unused-vars
    const { node, ...rest } = props;
    if (rest.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={rest.checked}
          readOnly
          className="mr-1.5 mt-[-1px] inline-block h-3.5 w-3.5 rounded border-line align-middle accent-brand-500"
        />
      );
    }
    return <input {...rest} />;
  },
};

function MarkdownImpl({ children }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownImpl);
