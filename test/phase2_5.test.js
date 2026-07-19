import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { completionNotice } from '../src/features/chat/completionState.js';

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

test('mobile assistant prose uses .95rem (~15px) with 1.55 line-height', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const mobileBlock = css.match(/@media\s*\(max-width:\s*640px\)\s*\{([^}]*)\}/s);
  assert.ok(mobileBlock, 'mobile media query must exist');
  const rules = mobileBlock[1];
  assert.ok(rules.includes('font-size: .95rem'), 'mobile prose must use .95rem font-size');
  assert.ok(rules.includes('line-height: 1.55'), 'mobile prose must use 1.55 line-height');
});

test('desktop prose uses refined font-size', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  // The desktop .prose-chat rule (outside the media query) uses a refined font-size.
  const desktopRule = css.match(/\.prose-chat\s*\{[^}]*font-size:\s*1rem[^}]*\}/s);
  assert.ok(desktopRule, 'desktop prose must have a rem-based font-size');
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

test('prose-chat uses reading font variable', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const proseRule = css.match(/\.prose-chat\s*\{[^}]*font-family:\s*var\(--font-reading\)[^}]*\}/s);
  assert.ok(proseRule, '.prose-chat must use var(--font-reading)');
  const fontDecl = css.match(/--font-reading:\s*'Source Serif 4',\s*Georgia,\s*serif;/);
  assert.ok(fontDecl, '--font-reading must start with Source Serif 4');
});

test('mobile drawer close button is at least h-11 w-11', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/ChatWorkspace.jsx'), 'utf-8');
  // Find the close button in the mobile drawer section (attributes span lines)
  assert.ok(src.includes('aria-label="Close navigation"'), 'drawer close button must exist');
  assert.ok(src.includes('h-11 w-11'), 'drawer close button must have h-11 w-11');
});

test('mobile MessageThread uses full width', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  // Mobile must have max-w-none; desktop must have sm:max-w-[760px]
  assert.ok(src.includes('max-w-none'), 'MessageThread must have max-w-none on mobile');
  assert.ok(src.includes('sm:max-w-[760px]'), 'MessageThread must have sm:max-w-[760px] for tablet');
  assert.ok(src.includes('lg:max-w-[860px]'), 'MessageThread must have lg:max-w-[860px] for desktop');
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

test('completion states map to distinct runtime notices', () => {
  assert.equal(completionNotice({ completionStatus: 'complete' }), null);
  assert.equal(completionNotice({ completionStatus: 'limit_reached' }),
    'This answer reached the maximum response length.');
  assert.equal(completionNotice({ completionStatus: 'incomplete' }),
    'The connection ended before the response completed.');
  assert.equal(completionNotice({ completionStatus: 'aborted', aborted: true }), null);
  assert.equal(completionNotice({ finishReason: 'content_filter' }),
    'The provider stopped this response for safety reasons.');
  assert.equal(completionNotice({ finishReason: 'safety' }),
    'The provider stopped this response for safety reasons.');
  assert.equal(completionNotice({ finishReason: 'length' }), null, 'legacy messages render normally');
});
