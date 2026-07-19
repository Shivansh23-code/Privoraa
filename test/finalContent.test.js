import test from 'node:test';
import assert from 'node:assert/strict';
import { finalContentPatch } from '../src/features/chat/finalContent.js';

test('finalContent replaces streamed partial content', () => {
  const message = { content: 'Complete. dangling' };
  assert.equal(
    ({ ...message, ...finalContentPatch({ finalContent: 'Complete.', tailTrimmed: true }) }).content,
    'Complete.'
  );
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

test('repair metadata is preserved with repaired final content', () => {
  const patch = finalContentPatch({
    finalContent: 'A repaired complete sentence.',
    repairAttempted: true,
    completionRepaired: true,
    repairSegments: 1,
  });
  assert.equal(patch.repairAttempted, true);
  assert.equal(patch.completionRepaired, true);
  assert.equal(patch.repairSegments, 1);
});

test('terminal finalContent wins atomically over a stale streamed snapshot', () => {
  const stale = { content: 'Complete. However, the cost', pending: true };
  const finalized = {
    ...stale,
    ...finalContentPatch({ finalContent: 'Complete.', tailTrimmed: true }),
    pending: false,
  };
  assert.equal(finalized.content, 'Complete.');
  assert.equal(finalized.pending, false);
});

test('rawFinishReason preserved in patch', () => {
  const patch = finalContentPatch({ rawFinishReason: 'stop' });
  assert.equal(patch.rawFinishReason, 'stop');
});

test('completionStatus preserved in patch', () => {
  const patch = finalContentPatch({ completionStatus: 'complete' });
  assert.equal(patch.completionStatus, 'complete');
});

test('finalizationReason preserved in patch', () => {
  const patch = finalContentPatch({ finalizationReason: 'structurally complete' });
  assert.equal(patch.finalizationReason, 'structurally complete');
});
