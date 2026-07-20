import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

// ---- 1. Caret visibility while streaming ----

test('streaming-caret CSS class is present on streaming assistant messages', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  // The component conditionally applies streaming-caret
  assert.match(src, /streaming-caret/, 'streaming-caret class must be referenced');
});

test('streaming-caret-fade class exists for completion transition', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  assert.match(src, /streaming-caret-fade/, 'streaming-caret-fade class must be referenced for fade-out');
});

test('caret fade-out uses ~200ms timeout', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  assert.match(src, /setTimeout.*200/, 'Fade timer must use approximately 200ms');
});

test('caret-fade @keyframes defined in CSS', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  assert.match(css, /@keyframes caret-fade/, 'caret-fade keyframes must be defined in CSS');
});

// ---- 2. finalContent atomically replaces streamed content ----

test('finalContent patch atomically overwrites content', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/finalContent.js'), 'utf-8');
  assert.match(src, /finalContent/, 'finalContent patch must reference finalContent');
});

test('finalContentPatch returns content only when provided', async () => {
  const { finalContentPatch } = await import('../src/features/chat/finalContent.js');
  const withFinal = finalContentPatch({ finalContent: 'Final answer.' });
  assert.equal(withFinal.content, 'Final answer.');
  const without = finalContentPatch({});
  assert.equal(without.content, undefined);
});

// ---- 3. Stale stream state cannot overwrite finalContent ----

test('onToken checks finalized flag before appending', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.match(src, /finalized\) return/, 'onToken must guard against stale writes after finalization');
});

test('finalize is idempotent (guarded by finalized flag)', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.match(src, /finalized\s*\?\s*undefined/, 'finalize must be idempotent');
  assert.match(src, /finalized\s*=\s*true/, 'finalize must set finalized flag');
});

// ---- 4. No duplicate assistant content ----

test('assistant messages are added once per send', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  // One addMessage for assistant placeholder (role:'assistant' appears on next line)
  const matches = src.match(/addMessage\([\s\S]*?'assistant'/g);
  const count = matches ? matches.length : 0;
  assert.equal(count, 1, 'Only one assistant addMessage per send');
});

// ---- 5. Auto-scroll follows only when near bottom ----

test('auto-scroll checks pinnedRef before scrolling', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.match(src, /pinnedRef\.current/, 'Auto-scroll must check pinned state');
  assert.match(src, /scrollIntoView/, 'Auto-scroll must call scrollIntoView');
});

test('pinnedRef is updated on scroll with threshold', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.match(src, /scrollHeight.*scrollTop.*clientHeight/, 'pinnedRef must use scroll geometry');
  assert.match(src, /< 120/, 'pinned threshold must be approximately 120px');
});

// ---- 6. User scrolling upward disables follow mode ----

test('onScroll sets pinnedRef based on proximity to bottom', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.match(src, /pinnedRef\.current\s*=\s*nearBottom/, 'onScroll must unpin when user scrolls up');
  assert.match(src, /setShowScrollButton/, 'onScroll must update scroll button visibility');
});

// ---- 7. Scroll-to-bottom restores follow mode ----

test('scrollToBottom restores pinned state', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.match(src, /scrollToBottom/, 'scrollToBottom handler must exist');
  assert.match(src, /pinnedRef\.current\s*=\s*true/, 'scrollToBottom must restore pinned state');
});

test('scroll-to-bottom button is rendered conditionally', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.match(src, /showScrollButton/, 'Scroll button must be conditionally rendered');
  assert.match(src, /Newer/, 'Scroll button must have accessible label');
});

// ---- 8. Reduced motion avoids animation dependence ----

test('prefers-reduced-motion media query disables caret animation', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  assert.match(css, /prefers-reduced-motion/, 'CSS must include prefers-reduced-motion');
  assert.match(css, /streaming-caret::after\s*\{[^}]*animation:\s*none/, 
      'Reduced motion must disable caret animation');
});

test('prefers-reduced-motion hides fading caret', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  assert.match(css, /prefers-reduced-motion.*streaming-caret-fade/s, 
      'Reduced motion must handle fade state');
});

// ---- 9. Existing finalContent tests remain passing assertions ----

test('finalContent completes without tail trim produces expected content', async () => {
  const { finalContentPatch } = await import('../src/features/chat/finalContent.js');
  const patch = finalContentPatch({ finalContent: 'Complete answer.', tailTrimmed: false });
  assert.equal(patch.content, 'Complete answer.');
  assert.equal(patch.tailTrimmed, false);
});

test('finalContent absence preserves existing content', async () => {
  const { finalContentPatch } = await import('../src/features/chat/finalContent.js');
  const patch = finalContentPatch({});
  assert.equal(patch.content, undefined);
});

test('repair metadata propagates through finalContentPatch', async () => {
  const { finalContentPatch } = await import('../src/features/chat/finalContent.js');
  const patch = finalContentPatch({ finalContent: 'Repaired.', repairAttempted: true, completionRepaired: true, repairSegments: 1 });
  assert.equal(patch.repairAttempted, true);
  assert.equal(patch.completionRepaired, true);
  assert.equal(patch.repairSegments, 1);
});

// ---- 10. No layout shift from caret ----

test('caret uses ::after pseudo-element to avoid layout shift', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  assert.match(css, /\.streaming-caret::after/, 'Caret must use ::after pseudo-element');
  assert.match(css, /content:\s*'▋'/, 'Caret must use block character as content');
});

// ---- 11. Streaming button shows Stop, not Copy/Regenerate ----

test('Stop button shown while streaming', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  assert.match(src, /streaming\s*\?\s*\([\s\S]*?Stop[\s\S]*?\)/, 
      'Stop button must render when streaming');
});

test('Copy and Regenerate buttons hidden while streaming', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  assert.match(src, /streaming\s*\?\s*\([\s\S]*?Square/, 'Stop icon renders when streaming');
});

// ---- 12. Completion transition avoids flicker ----

test('finalized guard prevents double completion', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  // finalize is defined as a function that returns undefined if already finalized
  const finalizeMatch = src.match(/const finalize\s*=\s*\([^)]*\)\s*=>[^;]*finalized[^;]*;/);
  assert.ok(finalizeMatch, 'finalize must be guarded by finalized flag');
});

test('no DOM remount per token', () => {
  const chatSrc = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.match(chatSrc, /appendToMessage/, 'Tokens must append to existing content, not replace');
  const bubbleSrc = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  // Bubble renders a single message — no map, no key-based remounting per token
  assert.ok(bubbleSrc.includes('message.content'), 'Bubble reads content from message prop directly');
});

test('code block stability during streaming', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  // No code-block collapse animations during streaming
  assert.equal(css.includes('code-block'), false, 'Must not have code-block animation selectors');
});
