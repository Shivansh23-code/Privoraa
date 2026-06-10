// Rich answer rendering: GitHub-flavoured markdown + KaTeX math + syntax
// highlighting, with a copy button and language label on every code block.

import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';

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
  const lang = /language-(\w+)/.exec(className || '')?.[1] || 'text';
  const code = nodeToText(children).replace(/\n$/, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#2c2e42] bg-[#0d1117]">
      <div className="flex items-center justify-between border-b border-[#2c2e42] px-3 py-1.5">
        <span className="font-mono text-xs text-brand-300">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className={`${className || ''} bg-transparent`}>{children}</code>
      </pre>
    </div>
  );
}

const components = {
  pre: ({ children }) => <>{children}</>,
  code({ className, children }) {
    const text = nodeToText(children);
    const isBlock = /language-/.test(className || '') || text.includes('\n');
    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    return (
      <code className="rounded-[5px] border border-line/70 bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-600 dark:text-brand-300">
        {children}
      </code>
    );
  },
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-600 underline decoration-brand-300/50 underline-offset-2 hover:decoration-brand-500 dark:text-brand-300"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-line bg-surface-2 px-3 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-line px-3 py-1.5">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-brand-400 bg-surface-2/60 py-1 pl-4 pr-2 text-muted">
      {children}
    </blockquote>
  ),
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
