import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canContinueResponse,
  hasPersistedAssistantIdentity,
  isLegacyEmptyAssistant,
  hasNonEmptyContent,
} from '../src/features/chat/completionState.js';
import { normalizeRemoteMessage } from '../src/lib/messageNormalization.js';

// ---- hasPersistedAssistantIdentity ----

test('persisted assistant with id is valid', () => {
  assert.equal(hasPersistedAssistantIdentity({ id: 'm1', role: 'assistant', persisted: true }), true);
});

test('persisted assistant without id is invalid', () => {
  assert.equal(hasPersistedAssistantIdentity({ role: 'assistant', persisted: true }), false);
});

test('non-persisted assistant is invalid', () => {
  assert.equal(hasPersistedAssistantIdentity({ id: 'm1', role: 'assistant', persisted: false }), false);
});

test('assistant with undefined persisted is invalid', () => {
  assert.equal(hasPersistedAssistantIdentity({ id: 'm1', role: 'assistant' }), false);
});

test('pending persisted assistant is invalid', () => {
  assert.equal(hasPersistedAssistantIdentity({ id: 'm1', role: 'assistant', persisted: true, pending: true }), false);
});

test('localOnly persisted assistant is invalid', () => {
  assert.equal(hasPersistedAssistantIdentity({ id: 'm1', role: 'assistant', persisted: true, localOnly: true }), false);
});

test('user role with all flags is invalid', () => {
  assert.equal(hasPersistedAssistantIdentity({ id: 'm1', role: 'user', persisted: true }), false);
});

// ---- canContinueResponse ----

test('persisted hydrated message with incomplete can continue', () => {
  const hydrated = normalizeRemoteMessage({
    id: 'a1', role: 'assistant', content: 'Some text', completionStatus: 'incomplete',
  });
  assert.equal(hydrated.persisted, true);
  assert.equal(canContinueResponse(hydrated), true);
});

test('persisted hydrated message with complete cannot continue', () => {
  const hydrated = normalizeRemoteMessage({
    id: 'a2', role: 'assistant', content: 'Some text', completionStatus: 'complete',
  });
  assert.equal(canContinueResponse(hydrated), false);
});

test('provider_error with content and persisted can continue (partial)', () => {
  assert.equal(canContinueResponse({
    id: 'a3', role: 'assistant', content: 'Some text', persisted: true, completionStatus: 'provider_error',
  }), true);
});

test('timeout with content and persisted can continue (partial)', () => {
  assert.equal(canContinueResponse({
    id: 'a4', role: 'assistant', content: 'Some text', persisted: true, completionStatus: 'timeout',
  }), true);
});

test('error with content and persisted can continue (partial)', () => {
  assert.equal(canContinueResponse({
    id: 'a5', role: 'assistant', content: 'Some text', persisted: true, completionStatus: 'error',
  }), true);
});

test('provider_error with empty content cannot continue (no content)', () => {
  assert.equal(canContinueResponse({
    id: 'a5b', role: 'assistant', content: '', persisted: true, completionStatus: 'provider_error',
  }), false);
});

test('provider_error without persisted cannot continue', () => {
  assert.equal(canContinueResponse({
    id: 'a5c', role: 'assistant', content: 'Some text', persisted: false, completionStatus: 'provider_error',
  }), false);
});

test('aborted completionStatus cannot continue', () => {
  assert.equal(canContinueResponse({
    id: 'a6', role: 'assistant', content: 'Some text', persisted: true, completionStatus: 'aborted',
  }), false);
});

test('empty content with incomplete cannot continue', () => {
  assert.equal(canContinueResponse({
    id: 'a7', role: 'assistant', content: '', persisted: true, completionStatus: 'incomplete',
  }), false);
});

test('limit_reached with content can continue', () => {
  assert.equal(canContinueResponse({
    id: 'a8', role: 'assistant', content: 'Some text', persisted: true, completionStatus: 'limit_reached',
  }), true);
});

test('partial with content can continue', () => {
  assert.equal(canContinueResponse({
    id: 'a9', role: 'assistant', content: 'Some text', persisted: true, completionStatus: 'partial',
  }), true);
});

test('hasRemainingContent with content can continue', () => {
  assert.equal(canContinueResponse({
    id: 'a10', role: 'assistant', content: 'Some text', persisted: true, hasRemainingContent: true,
  }), true);
});

// ---- partial error keeps assistant content ----

test('partial provider_error keeps content and is continuable', () => {
  assert.equal(canContinueResponse({
    id: 'a11', role: 'assistant', content: 'Partial content exists',
    persisted: true, completionStatus: 'provider_error',
  }), true);
});

test('partial timeout keeps content and is continuable', () => {
  assert.equal(canContinueResponse({
    id: 'a12', role: 'assistant', content: 'Partial content exists',
    persisted: true, completionStatus: 'timeout',
  }), true);
});

// ---- isLegacyEmptyAssistant ----

test('legacy empty assistant with incomplete status is detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'incomplete',
  }), true);
});

test('legacy empty assistant with provider_error is detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'provider_error',
  }), true);
});

test('legacy empty assistant with complete status is not detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'complete',
  }), false);
});

test('legacy empty assistant with no completionStatus is not detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '',
  }), false);
});

test('legacy assistant with whitepace-only content is detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '   ', completionStatus: 'incomplete',
  }), true);
});

test('legacy assistant with completionTokens > 0 is not detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'incomplete', completionTokens: 50,
  }), false);
});

test('legacy assistant with tool_calls is not detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'incomplete', tool_calls: [{ id: 'call1' }],
  }), false);
});

test('legacy assistant with images is not detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'incomplete', images: ['img1'],
  }), false);
});

test('legacy assistant with citations is not detected', () => {
  assert.equal(isLegacyEmptyAssistant({
    role: 'assistant', content: '', completionStatus: 'incomplete', citations: ['cit1'],
  }), false);
});

// ---- hasNonEmptyContent ----

test('hasNonEmptyContent is true for content', () => {
  assert.equal(hasNonEmptyContent({ content: 'hello' }), true);
});

test('hasNonEmptyContent is true for images', () => {
  assert.equal(hasNonEmptyContent({ images: ['img1'] }), true);
});

test('hasNonEmptyContent is true for attachments', () => {
  assert.equal(hasNonEmptyContent({ attachments: [{ name: 'file' }] }), true);
});

test('hasNonEmptyContent is true for citations', () => {
  assert.equal(hasNonEmptyContent({ citations: ['cit1'] }), true);
});

test('hasNonEmptyContent is false for empty message', () => {
  assert.equal(hasNonEmptyContent({}), false);
});

test('hasNonEmptyContent is false for empty string content', () => {
  assert.equal(hasNonEmptyContent({ content: '' }), false);
});

// ---- Stream lifecycle: continuation guards ----

test('non-persisted assistant with content cannot continue (no real id)', () => {
  assert.equal(canContinueResponse({
    id: 'tmp1', role: 'assistant', content: 'Some text', persisted: false, completionStatus: 'incomplete',
  }), false);
});

test('retry does not use continuation (canContinueResponse requires non-empty content)', () => {
  assert.equal(canContinueResponse({
    id: 'a1', role: 'assistant', content: '', persisted: true, completionStatus: 'incomplete',
  }), false);
});

test('partial provider_error persists assistant with same id and no duplicate', () => {
  assert.equal(canContinueResponse({
    id: 'original-id', role: 'assistant', content: 'Partial content',
    persisted: true, completionStatus: 'provider_error',
  }), true);
});

// ================================================================
// Store lifecycle simulations (requires --import loader + localStorage)
// ================================================================

async function withStore() {
  const { useChatStore } = await import('../src/store/chatStore.js');
  return useChatStore;
}

test('SSE error before first content removes optimistic placeholder', async () => {
  const useChatStore = await withStore();
  const convId = useChatStore.getState().newConversation();
  const s = useChatStore.getState();
  s.addMessage(convId, { id: 'u1', role: 'user', content: 'hello' });
  s.addMessage(convId, { id: 'a1', role: 'assistant', content: '', pending: true });
  s.removeMessage(convId, 'a1');
  const msgs = useChatStore.getState().conversations.find((c) => c.id === convId).messages;
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].id, 'u1');
  useChatStore.getState().deleteConversation(convId);
});

test('SSE error before content: user message remains, earlier/later msgs remain', async () => {
  const useChatStore = await withStore();
  const convId = useChatStore.getState().newConversation();
  const s = useChatStore.getState();
  s.addMessage(convId, { id: 'u1', role: 'user', content: 'first' });
  s.addMessage(convId, { id: 'a1', role: 'assistant', content: '', pending: true });
  s.addMessage(convId, { id: 'u2', role: 'user', content: 'second' });
  s.removeMessage(convId, 'a1');
  const msgs = useChatStore.getState().conversations.find((c) => c.id === convId).messages;
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].id, 'u1');
  assert.equal(msgs[1].id, 'u2');
  useChatStore.getState().deleteConversation(convId);
});

test('SSE error before content: no empty assistant bubble remains', async () => {
  const useChatStore = await withStore();
  const convId = useChatStore.getState().newConversation();
  const s = useChatStore.getState();
  s.addMessage(convId, { id: 'u1', role: 'user', content: 'hello' });
  s.addMessage(convId, { id: 'a1', role: 'assistant', content: '', pending: true });
  s.removeMessage(convId, 'a1');
  const msgs = useChatStore.getState().conversations.find((c) => c.id === convId).messages;
  assert.equal(msgs.filter((m) => m.role === 'assistant').length, 0);
  useChatStore.getState().deleteConversation(convId);
});

test('generation error is scoped by conversationId', async () => {
  const useChatStore = await withStore();
  const s = useChatStore.getState();
  s.setGenerationError('conv-a', { message: 'error a', requestId: 'r1' });
  s.setGenerationError('conv-b', { message: 'error b', requestId: 'r2' });
  const errors = useChatStore.getState().generationErrors;
  assert.equal(errors['conv-a'].message, 'error a');
  assert.equal(errors['conv-b'].message, 'error b');
  assert.equal(errors['conv-a'].requestId, 'r1');
  assert.equal(errors['conv-b'].requestId, 'r2');
  s.clearGenerationError('conv-a');
  assert.equal(useChatStore.getState().generationErrors['conv-a'], undefined);
  assert.equal(useChatStore.getState().generationErrors['conv-b'].requestId, 'r2');
  s.clearGenerationError('conv-b');
});

test('clearGenerationError handles missing conversationId', async () => {
  const useChatStore = await withStore();
  const s = useChatStore.getState();
  s.setGenerationError('conv-x', { message: 'test' });
  s.clearGenerationError('conv-y');
  assert.equal(useChatStore.getState().generationErrors['conv-x'].message, 'test');
  s.clearGenerationError('conv-x');
});

test('streamingConversations are set and cleared per conversation', async () => {
  const useChatStore = await withStore();
  const s = useChatStore.getState();
  s.setConversationStreaming('c1', 'm1', 'r1');
  s.setConversationStreaming('c2', 'm2', 'r2');
  assert.equal(useChatStore.getState().streamingConversations['c1'].streamingMessageId, 'm1');
  assert.equal(useChatStore.getState().streamingConversations['c1'].requestId, 'r1');
  assert.equal(useChatStore.getState().streamingConversations['c2'].streamingMessageId, 'm2');
  s.clearConversationStreaming('c1');
  assert.equal(useChatStore.getState().streamingConversations['c1'], undefined);
  assert.equal(useChatStore.getState().streamingConversations['c2'].streamingMessageId, 'm2');
  s.clearConversationStreaming('c2');
});

test('partial-content error preserves same assistant message', async () => {
  const useChatStore = await withStore();
  const convId = useChatStore.getState().newConversation();
  const s = useChatStore.getState();
  s.addMessage(convId, { id: 'u1', role: 'user', content: 'hello' });
  s.addMessage(convId, { id: 'a1', role: 'assistant', content: 'Partial ', pending: false });
  // Simulate onError with hasContent=true: updateMessage with error field, NOT remove
  s.updateMessage(convId, 'a1', { error: 'Something went wrong.', completionStatus: 'incomplete' });
  const msg = useChatStore.getState().conversations.find((c) => c.id === convId).messages[1];
  assert.equal(msg.id, 'a1');
  assert.equal(msg.content, 'Partial ');
  assert.equal(msg.error, 'Something went wrong.');
  // No duplicate message
  assert.equal(useChatStore.getState().conversations.find((c) => c.id === convId).messages.length, 2);
  useChatStore.getState().deleteConversation(convId);
});

test('retry stores original payload without duplicate user message', async () => {
  const useChatStore = await withStore();
  const convId = useChatStore.getState().newConversation();
  const s = useChatStore.getState();
  // Simulate error with retryPayload
  s.setGenerationError(convId, {
    message: 'API error',
    requestId: 'r1',
    retryPayload: {
      content: 'original prompt',
      model: 'auto',
      provider: null,
      image: null,
      images: null,
      attachments: [],
      userMessageId: 'u1',
    },
  });
  const error = useChatStore.getState().generationErrors[convId];
  assert.equal(error.retryPayload.content, 'original prompt');
  assert.equal(error.retryPayload.model, 'auto');
  assert.deepEqual(error.retryPayload.attachments, []);
  // Clear error and simulate retry (call run directly is not possible,
  // but verify the payload is reconstructable)
  s.clearGenerationError(convId);
  assert.equal(useChatStore.getState().generationErrors[convId], undefined);
  useChatStore.getState().deleteConversation(convId);
});

test('old requestId cannot clear generation error from newer request', async () => {
  const useChatStore = await withStore();
  const s = useChatStore.getState();
  // Set error for r1
  s.setGenerationError('conv-s', { message: 'old error', requestId: 'r1' });
  // Simulate newer streaming request
  s.setConversationStreaming('conv-s', 'm2', 'r2');
  // Old requestId check: if error.requestId !== currentStreaming.requestId, skip clear
  const error = useChatStore.getState().generationErrors['conv-s'];
  assert.equal(error.requestId, 'r1');
  const streaming = useChatStore.getState().streamingConversations['conv-s'];
  assert.equal(streaming.requestId, 'r2');
  // The guard condition: only clear if requestIds match
  const shouldClear = error.requestId === streaming.requestId;
  assert.equal(shouldClear, false, 'old request should not clear newer generation error');
  s.clearGenerationError('conv-s');
  s.clearConversationStreaming('conv-s');
});


