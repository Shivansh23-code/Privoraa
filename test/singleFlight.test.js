import test from 'node:test';
import assert from 'node:assert/strict';
import { createSingleFlightGuard } from '../src/features/chat/singleFlight.js';

async function simulateSubmissions(count) {
  const guard = createSingleFlightGuard();
  let fetches = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const submit = async () => {
    if (!guard.tryStart()) return;
    fetches += 1;
    try { await pending; } finally { guard.finish(); }
  };
  const attempts = Array.from({ length: count }, submit);
  await Promise.resolve();
  release();
  await Promise.all(attempts);
  return fetches;
}

test('one submit creates one stream request', async () => {
  assert.equal(await simulateSubmissions(1), 1);
});

test('double click creates one stream request', async () => {
  assert.equal(await simulateSubmissions(2), 1);
});

test('Enter followed by form submit creates one stream request', async () => {
  assert.equal(await simulateSubmissions(2), 1);
});

test('guard clears only after terminal completion', async () => {
  const guard = createSingleFlightGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.tryStart(), false);
  guard.finish();
  assert.equal(guard.tryStart(), true);
});
