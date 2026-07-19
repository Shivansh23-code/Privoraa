import test from 'node:test';
import assert from 'node:assert/strict';
import { finalContentPatch } from '../src/features/chat/finalContent.js';

test('finalContent replaces streamed partial content', () => {
  const message = { content: 'Complete. dangling' };
  assert.equal(({ ...message, ...finalContentPatch({ finalContent: 'Complete.', tailTrimmed: true }) }).content,
    'Complete.');
});

test('absence of finalContent preserves existing content', () => {
  const message = { content: 'Existing stream' };
  assert.equal(({ ...message, ...finalContentPatch({}) }).content, 'Existing stream');
});

test('complete responses are not trimmed', () => {
  const patch = finalContentPatch({ finalContent: 'Complete. Intentional tail', tailTrimmed: false });
  assert.equal(patch.content, 'Complete. Intentional tail');
  assert.equal(patch.tailTrimmed, false);
});

test('tailTrimmed metadata is preserved', () => {
  assert.equal(finalContentPatch({ tailTrimmed: true }).tailTrimmed, true);
});
