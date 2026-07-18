import test from 'node:test';
import assert from 'node:assert/strict';
import { clipboardImages, shouldSubmitFromKey, validateImageFile } from '../src/features/chat/composerInput.js';
import { normalizeTheme, resolveTheme } from '../src/context/themePreference.js';
import { readySourceCount, shouldDisableSourcesAfterRemoval } from '../src/features/chat/sourceState.js';

test('Enter submits while Shift+Enter and IME composition do not', () => {
  assert.equal(shouldSubmitFromKey({ key: 'Enter', shiftKey: false }), true);
  assert.equal(shouldSubmitFromKey({ key: 'Enter', shiftKey: true }), false);
  assert.equal(shouldSubmitFromKey({ key: 'Enter', isComposing: true }), false);
  assert.equal(shouldSubmitFromKey({ key: 'Enter', nativeEvent: { isComposing: true } }), false);
});

test('image validation accepts supported images and rejects invalid or oversized files', () => {
  assert.equal(validateImageFile({ type: 'image/png', size: 1024 }), null);
  assert.match(validateImageFile({ type: 'image/gif', size: 1024 }), /PNG/);
  assert.match(validateImageFile({ type: 'image/jpeg', size: 11 * 1024 * 1024 }), /10 MB/);
});

test('clipboard image extraction ignores text and invalid items', () => {
  const png = { type: 'image/png', size: 20 };
  const items = [
    { type: 'text/plain', getAsFile: () => null },
    { type: 'image/png', getAsFile: () => png },
  ];
  assert.deepEqual(clipboardImages({ items }), [png]);
});

test('theme defaults to system and resolves explicit preferences', () => {
  assert.equal(normalizeTheme(null), 'system');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('light', true), 'light');
});

test('only ready sources enable grounding and removing the final ready source disables it', () => {
  const documents = [{ id: 'a', status: 'PROCESSING' }, { id: 'b', status: 'READY' }, { id: 'c', status: 'FAILED' }];
  assert.equal(readySourceCount(documents), 1);
  assert.equal(shouldDisableSourcesAfterRemoval(documents, 'b'), true);
  assert.equal(shouldDisableSourcesAfterRemoval([...documents, { id: 'd', status: 'READY' }], 'b'), false);
});
