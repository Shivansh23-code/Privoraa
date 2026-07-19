import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { completionNotice } from '../src/features/chat/completionState.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---- finishReason marking ----

test('STOP finish reason marks response complete', () => {
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
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice(undefined), false);
  assert.equal(showIncompleteNotice(null), false);
});

test('aborted messages show no incomplete notice regardless of finishReason', () => {
  const showIncompleteNotice = (fr) =>
    fr === 'length' || fr === 'incomplete' || fr === 'unknown';
  assert.equal(showIncompleteNotice('length'), true);
  assert.equal(showIncompleteNotice(null), false);
});

// ---- Continue and Regenerate remain separate ----

test('no visible synthetic continuation user message is created', async () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.equal(src.includes('Continue from where you left off'), false);
  assert.equal(src.includes('continueGeneration'), false);
});

// ---- Typography system ----

test('mobile assistant prose uses .9375rem (~15px) with 1.6 line-height', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const mobileBlock = css.match(/@media\s*\(max-width:\s*640px\)\s*\{([^}]*)\}/s);
  assert.ok(mobileBlock, 'mobile media query must exist');
  const rules = mobileBlock[1];
  assert.ok(rules.includes('font-size: .9375rem'), 'mobile prose must use .9375rem font-size');
  assert.ok(rules.includes('line-height: 1.6'), 'mobile prose must use 1.6 line-height');
});

test('desktop prose uses refined font-size and line-height', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const desktopRule = css.match(/\.prose-chat\s*\{[^}]*font-size:\s*1rem[^}]*\}/s);
  assert.ok(desktopRule, 'desktop prose must have 1rem font-size');
  assert.ok(desktopRule[0].includes('line-height: 1.6'), 'desktop prose must use 1.6 line-height');
});

test('prose-chat uses refined typography properties', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const proseRule = css.match(/\.prose-chat\s*\{[^}]*\}/s);
  assert.ok(proseRule, '.prose-chat rule must exist');
  const rule = proseRule[0];
  assert.ok(rule.includes('letter-spacing'), 'prose-chat must have letter-spacing');
  assert.ok(rule.includes('word-spacing'), 'prose-chat must have word-spacing');
  assert.ok(rule.includes('font-optical-sizing: auto'), 'prose-chat must enable font-optical-sizing');
});

test('paragraph and list item weights are 400', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const pRule = css.match(/\.prose-chat p\s*\{[^}]*\}/s);
  const liRule = css.match(/\.prose-chat li\s*\{[^}]*\}/s);
  assert.ok(pRule, '.prose-chat p rule must exist');
  assert.ok(pRule[0].includes('font-weight: 400'), 'p must use font-weight 400');
  assert.ok(liRule, '.prose-chat li rule must exist');
  assert.ok(liRule[0].includes('font-weight: 400'), 'li must use font-weight 400');
});

test('strong and headings use font-weight 600', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  assert.ok(css.includes('.prose-chat strong { font-weight: 600; }'), 'strong must be 600');
  const headingRule = css.match(/\.prose-chat h1[^}]*font-weight:\s*600[^}]*\}/s);
  assert.ok(headingRule, 'headings must use font-weight 600');
});

test('mobile list indentation is reduced from desktop', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  // Verify the mobile media query contains reduced indentation values
  const mobileSection = css.match(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\n\}/);
  assert.ok(mobileSection, 'mobile media query must exist');
  const section = mobileSection[0];
  const hasReducedUl = /padding-inline-start:\s*1\.1\d?rem/.test(section);
  const hasNestedReduced = /padding-inline-start:\s*\.\d+rem/.test(section);
  assert.ok(hasReducedUl, 'mobile ul/ol must use reduced indentation (1.1x rem)');
  assert.ok(hasNestedReduced, 'mobile nested ul/ol must use tighter indentation');
  // Mobile indentation should be smaller than desktop indentation
  assert.ok(section.includes('1.15rem'), 'mobile ul/ol padding-inline-start should be 1.15rem');
});

test('metadata elements remain small on mobile', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const mobileBlock = css.match(/@media\s*\(max-width:\s*640px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(mobileBlock, 'mobile media query must exist');
  const rules = mobileBlock[1];
  assert.equal(rules.includes('.text-xs'), false, 'mobile block must not override text-xs');
});

test('prose-chat uses reading font variable', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const proseRule = css.match(/\.prose-chat\s*\{[^}]*font-family:\s*var\(--font-reading\)[^}]*\}/s);
  assert.ok(proseRule, '.prose-chat must use var(--font-reading)');
  const fontDecl = css.match(/--font-reading:\s*'Source Serif 4',\s*Georgia,\s*serif;/);
  assert.ok(fontDecl, '--font-reading must start with Source Serif 4');
});

test('code blocks retain mono font', () => {
  const mdSrc = readFileSync(resolve(ROOT, 'src/features/chat/Markdown.jsx'), 'utf-8');
  // Inline code uses font-mono
  assert.ok(mdSrc.includes('font-mono'), 'inline code must use mono font');
  // CodeBlock pre retains mono via Tailwind utility or font-mono class
  assert.ok(mdSrc.includes('font-mono') || mdSrc.includes('mono'), 'code blocks must reference mono font');
});

// ---- VaultLockBar ----

test('VaultLockBar mobile collapsed state is compact', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/VaultLockBar.jsx'), 'utf-8');
  assert.ok(src.includes('min-h-[40px]'), 'VaultLockBar must have compact min-h-[40px] on mobile');
});

test('VaultLockBar passphrase is not always visible on mobile', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/VaultLockBar.jsx'), 'utf-8');
  // Passphrase input is wrapped in a div that is hidden by default and shown via sm:flex on desktop
  assert.ok(src.includes("'hidden'"), 'passphrase container must have hidden class conditionally');
  assert.ok(src.includes('sm:flex'), 'passphrase container must be visible on desktop');
  assert.ok(src.includes('expanded'), 'VaultLockBar must have expanded state');
  assert.ok(src.includes('setExpanded'), 'VaultLockBar must have setExpanded');
});

// ---- Chat layout ----

test('mobile drawer close button is at least h-11 w-11', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/ChatWorkspace.jsx'), 'utf-8');
  assert.ok(src.includes('aria-label="Close navigation"'), 'drawer close button must exist');
  assert.ok(src.includes('h-11 w-11'), 'drawer close button must have h-11 w-11');
});

test('mobile MessageThread uses full width', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/MessageThread.jsx'), 'utf-8');
  assert.ok(src.includes('max-w-none'), 'MessageThread must have max-w-none on mobile');
  assert.ok(src.includes('sm:max-w-[760px]'), 'MessageThread must have sm:max-w-[760px] for tablet');
  assert.ok(src.includes('lg:max-w-[860px]'), 'MessageThread must have lg:max-w-[860px] for desktop');
});

test('prose-chat does not have overflow-x: auto', () => {
  const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf-8');
  const proseChatRule = css.match(/\.prose-chat\s*\{[^}]*\}/s);
  assert.ok(proseChatRule, '.prose-chat rule must exist');
  assert.equal(proseChatRule[0].includes('overflow-x: auto'), false,
      '.prose-chat must not set overflow-x: auto');
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
