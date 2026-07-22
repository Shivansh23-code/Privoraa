import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantRunPlan, manualContinuationOptions } from '../src/features/chat/continuationMode.js';

test('manual continuation reuses one assistant bubble and creates no user message', () => {
  const plan = assistantRunPlan({ isContinuation: true, targetAssistantMessageId: 'assistant-1' });
  assert.deepEqual(plan, {
    addUserMessage: false, addAssistantMessage: false, assistantId: 'assistant-1',
  });
});

test('manual continuation preserves target content and routing', () => {
  assert.deepEqual(manualContinuationOptions({
    id: 'assistant-1', content: 'Existing answer', model: 'model-1', selectedProvider: 'ollama',
  }), {
    isContinuation: true, targetAssistantMessageId: 'assistant-1', existingContent: 'Existing answer',
    modelOverride: 'model-1', providerOverride: 'ollama',
  });
});
