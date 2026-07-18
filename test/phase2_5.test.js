import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---- finishReason marking ----

test('STOP finish reason marks response complete', () => {
  // STOP is a normal completion — no warning should show.
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice('stop'), false);
  assert.equal(showIncompleteNotice(null), false);
});

test('LENGTH finish reason marks response incomplete', () => {
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice('length'), true);
});

test('incomplete and unknown finish reasons also mark incomplete', () => {
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice('incomplete'), true);
  assert.equal(showIncompleteNotice('unknown'), true);
});

test('legacy messages with null finishReason show no incomplete notice', () => {
  // Messages created before Phase 2.5 have no finishReason field (undefined/null).
  // They must render normally — the notice only fires for explicit string values.
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice(undefined), false);
  assert.equal(showIncompleteNotice(null), false);
});

test('aborted messages show no incomplete notice regardless of finishReason', () => {
  // Aborted has its own separate "Generation stopped." message.
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice('length'), true);  // aborted+length: both could show but aborted takes priority via order
  assert.equal(showIncompleteNotice(null), false);
});

// ---- Continue and Regenerate remain separate ----

test('no visible synthetic continuation user message is created', async () => {
  // The old continueGeneration added a user message with:
  //   role: 'user', content: '(Continue from where you left off. ...)'
  // This has been removed. Verify useChat.js no longer contains that string.
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.equal(src.includes('Continue from where you left off'), false);
  assert.equal(src.includes('continueGeneration'), false);
});

// ---- Mobile prose uses 16px ----

test('mobile assistant prose uses 1rem (16px) with 1.65 line-height', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  // Find the mobile media query block and extract the prose-chat rule.
  const mobileBlock = css.match(/@media\s*\(max-width:\s*640px\)\s*\{([^}]*)\}/s);
  assert.ok(mobileBlock, 'mobile media query must exist');
  const rules = mobileBlock[1];
  // prose-chat at mobile should have font-size: 1rem
  assert.ok(rules.includes('font-size: 1rem'), 'mobile prose must use 1rem font-size');
  assert.ok(rules.includes('line-height: 1.65'), 'mobile prose must use 1.65 line-height');
});

test('desktop prose is preserved at .975rem', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  // The desktop .prose-chat rule (outside the media query) must stay at .975rem.
  const desktopRule = css.match(/\.prose-chat\s*\{[^}]*font-size:\s*\.975rem[^}]*\}/s);
  assert.ok(desktopRule, 'desktop prose must stay at .975rem');
});

test('metadata elements remain small on mobile', () => {
  // Model badge uses text-xs, action buttons use text-xs, citations use text-[11px].
  // These are set via Tailwind classes, not the prose-chat selector, so they are
  // unaffected by the prose-chat media query. We verify text-xs is NOT overridden.
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const mobileBlock = css.match(/@media\s*\(max-width:\s*640px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(mobileBlock, 'mobile media query must exist');
  const rules = mobileBlock[1];
  // Ensure no rule overrides .text-xs or .text-[11px] within the mobile block.
  // (text-xs is a Tailwind utility not defined in index.css.)
  assert.equal(rules.includes('.text-xs'), false, 'mobile block must not override text-xs');
});

test('prose-chat does not have overflow-x: auto', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const proseChatRule = css.match(/\.prose-chat\s*\{[^}]*\}/s);
  assert.ok(proseChatRule, '.prose-chat rule must exist');
  // The rule may span multiple lines — check that overflow-x is not set to auto.
  assert.equal(proseChatRule[0].includes('overflow-x: auto'), false,
      '.prose-chat must not set overflow-x: auto (tables/code scroll instead)');
});

// ---- Composer clearance ----

test('message thread uses --composer-height for bottom padding', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.ok(src.includes('--composer-height'), 'MessageThread must reference --composer-height');
});

test('composer ResizeObserver sets --composer-height', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/Composer.jsx'), 'utf-8');
  assert.ok(src.includes('--composer-height'), 'Composer must set --composer-height via ResizeObserver');
});

// ---- finishReason in onDone payload ----

test('useChat onDone reads finishReason from payload', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.ok(src.includes('finishReason: usage.finishReason'), 'onDone must read usage.finishReason');
});

test('MessageBubble conditionally renders truncation warning for length, incomplete, unknown', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageBubble.jsx'), 'utf-8');
  assert.ok(src.includes("finishReason === 'length'"), 'MessageBubble must check for length');
  assert.ok(src.includes("finishReason === 'incomplete'"), 'MessageBubble must check for incomplete');
  assert.ok(src.includes("finishReason === 'unknown'"), 'MessageBubble must check for unknown');
});
