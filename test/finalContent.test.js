import test from 'node:test';
import assert from 'node:assert/strict';
import { finalContentPatch, reconcileFinalContent, safeMerge } from '../src/features/chat/finalContent.js';

// ---- safeMerge ----

test('safeMerge concatenates non-overlapping content', () => {
  assert.equal(safeMerge('Hello. ', 'World.'), 'Hello. World.');
});

test('safeMerge deduplicates overlapping content', () => {
  assert.equal(safeMerge('Hello world. ', ' world. More.'), 'Hello world.  world. More.');
});

test('safeMerge detects long overlap', () => {
  assert.equal(safeMerge('This is the same prefix.', 'This is the same prefix. And more.'), 'This is the same prefix. And more.');
});

test('safeMerge ignores small coincidental overlap below 12 chars', () => {
  assert.equal(safeMerge('Short. ', 'Short. More.'), 'Short. Short. More.');
});

test('safeMerge handles code fence boundary at 3 backticks', () => {
  assert.equal(safeMerge('```\ncode\n```', '```\nmore code\n```'), '```\ncode\n```\nmore code\n```');
});

test('safeMerge preserves empty base', () => {
  assert.equal(safeMerge('', 'New content'), 'New content');
});

test('safeMerge preserves empty next', () => {
  assert.equal(safeMerge('Base content', ''), 'Base content');
});

test('safeMerge handles both empty', () => {
  assert.equal(safeMerge('', ''), '');
});

test('safeMerge uses custom overlap window', () => {
  assert.equal(safeMerge('Prefix content here. More.', 'Prefix content here. More. Extra.', 10), 'Prefix content here. More.Prefix content here. More. Extra.');
  assert.equal(safeMerge('Prefix content here. More.', 'Prefix content here. More. Extra.', 80), 'Prefix content here. More. Extra.');
});

// ---- reconcileFinalContent (three-value) ----

test('shorter terminal content cannot erase accumulated code', () => {
  const streamed = 'Explanation\n```js\nconsole.log("kept");\n```';
  assert.equal(reconcileFinalContent('', streamed, 'Explanation'), streamed);
});

test('terminal content may extend the accumulated stream', () => {
  assert.equal(reconcileFinalContent('', 'partial', 'partial answer'), 'partial answer');
});

test('finalContent replaces streamed partial content', () => {
  const message = { content: 'Complete. dangling' };
  assert.equal(
    ({ ...message, ...finalContentPatch({ finalContent: 'Complete.', tailTrimmed: true }, '') }).content,
    'Complete.'
  );
});

test('absence of finalContent preserves existing content', () => {
  const message = { content: 'Existing stream' };
  assert.equal(({ ...message, ...finalContentPatch({}) }).content, 'Existing stream');
});

test('complete responses are not trimmed', () => {
  const patch = finalContentPatch({ finalContent: 'Complete. Intentional tail', tailTrimmed: false }, '');
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

test('incomplete continuation metadata is preserved without replacing longer streamed content', () => {
  const patch = finalContentPatch({
    finalContent: 'short', normalizedFinishReason: 'max_tokens', incomplete: true,
    continuationExhausted: true,
  }, '', 'longer streamed content');
  assert.equal(patch.content, 'longer streamed content');
  assert.equal(patch.normalizedFinishReason, 'max_tokens');
  assert.equal(patch.incomplete, true);
  assert.equal(patch.continuationExhausted, true);
});

test('finalizationReason preserved in patch', () => {
  const patch = finalContentPatch({ finalizationReason: 'structurally complete' });
  assert.equal(patch.finalizationReason, 'structurally complete');
});

test('planned segmentation metadata is preserved in the terminal patch', () => {
  const patch = finalContentPatch({
    completionStatus: 'partial', finalizationReason: 'PLANNED_SEGMENTATION',
    hasRemainingContent: true, segmentIndex: 1, totalSegments: 2,
    completedSections: ['Entity'], remainingSections: ['Security'],
  });
  assert.equal(patch.hasRemainingContent, true);
  assert.equal(patch.segmentIndex, 1);
  assert.equal(patch.totalSegments, 2);
  assert.deepEqual(patch.remainingSections, ['Security']);
});

// ---- three-value continuation scenarios ----

test('continuation with authoritative finalContent uses server version', () => {
  const base = 'Original assistant response.';
  const run = ' Continued content.';
  const final = 'Original assistant response. Continued content.';
  assert.equal(reconcileFinalContent(base, run, final), 'Original assistant response. Continued content.');
});

test('continuation where server drops base uses safeMerge fallback', () => {
  const base = 'Original assistant response with quite a long base.';
  const run = ' And new content.';
  const final = ' And new content.';
  assert.equal(reconcileFinalContent(base, run, final), 'Original assistant response with quite a long base. And new content.');
});

test('non-continuation with streamed + finalContent uses final', () => {
  assert.equal(reconcileFinalContent('', 'Streamed tokens here.', 'Streamed tokens here.'), 'Streamed tokens here.');
});

test('continuation with empty finalContent uses safeMerge', () => {
  const base = 'Base content.';
  const run = ' Extra content.';
  assert.equal(reconcileFinalContent(base, run, null), 'Base content. Extra content.');
});
