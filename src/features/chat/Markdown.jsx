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
    <div className="my-5 overflow-hidden rounded-2xl border border-line bg-[#08090b] shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-xs text-accent-500">{lang}</span>
        <button
          onClick={copy}
          aria-label={`Copy ${lang} code`}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted transition hover:bg-white/5 hover:text-fg"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto p-4 text-[14px] leading-relaxed sm:text-[13.5px]">
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
      <code className="rounded-[4px] border border-line/60 bg-surface-2/80 px-[5px] py-[2px] font-mono text-[.88em] text-brand-600 dark:text-brand-300">
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
    <div className="scroll-thin my-5 overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-line bg-surface-2 px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-line px-3 py-2">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-[var(--accent-primary)] bg-surface-2/50 py-1 pl-4 pr-3 text-muted">
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
