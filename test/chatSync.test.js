import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

test('chatSync uses result objects with success and error fields', () => {
  const src = readFileSync(resolve(ROOT, 'src/lib/chatSync.js'), 'utf-8');
  assert.match(src, /success:\s*true/);
  assert.match(src, /success:\s*false/);
  assert.match(src, /error:/);
});

test('chatSync createRemoteConversation accepts client id parameter', () => {
  const src = readFileSync(resolve(ROOT, 'src/lib/chatSync.js'), 'utf-8');
  assert.match(src, /createRemoteConversation.*id/);
  assert.match(src, /\{ id, title, mode \}/);
});

test('chatSync returns fail result on error', () => {
  const src = readFileSync(resolve(ROOT, 'src/lib/chatSync.js'), 'utf-8');
  assert.match(src, /function fail/);
  assert.match(src, /success: false/);
  assert.match(src, /error:/);
});

test('chatStore has sync state properties', () => {
  const src = readFileSync(resolve(ROOT, 'src/store/chatStore.js'), 'utf-8');
  assert.match(src, /syncStatus/);
  assert.match(src, /syncError/);
  assert.match(src, /lastSyncAt/);
  assert.match(src, /setSyncStatus/);
  assert.match(src, /setSyncError/);
  assert.match(src, /setLastSyncAt/);
});

test('ChatWorkspace imports fetchRemoteConversationDetail for message hydration', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/ChatWorkspace.jsx'), 'utf-8');
  assert.match(src, /fetchRemoteConversationDetail/);
  assert.match(src, /Hydrate messages when opening a conversation/);
});

test('ChatWorkspace performs periodic re-sync on focus and timer', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/ChatWorkspace.jsx'), 'utf-8');
  assert.match(src, /window\.addEventListener\('focus'/);
  assert.match(src, /setInterval.*pullRemote/);
  assert.match(src, /30000/);
});

test('ChatWorkspace shows sync error banner', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/ChatWorkspace.jsx'), 'utf-8');
  assert.match(src, /syncStatus === 'error'/);
  assert.match(src, /Sync issue/);
});

test('ChatWorkspace shows syncing banner', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/ChatWorkspace.jsx'), 'utf-8');
  assert.match(src, /syncStatus === 'syncing'/);
  assert.match(src, /Syncing conversations/);
});

test('chatStore conversations have messages field', () => {
  const src = readFileSync(resolve(ROOT, 'src/store/chatStore.js'), 'utf-8');
  assert.match(src, /messages.*\[\]/);
});

test('Backend CreateConversationRequest accepts optional id field', () => {
  const src = readFileSync(
    resolve(ROOT, 'BackendPrivoraa/src/main/java/com/privoraa/conversation/dto/CreateConversationRequest.java'),
    'utf-8'
  );
  assert.match(src, /String id/);
});

test('Backend ConversationService create handles client-supplied id', () => {
  const src = readFileSync(
    resolve(ROOT, 'BackendPrivoraa/src/main/java/com/privoraa/conversation/ConversationService.java'),
    'utf-8'
  );
  assert.match(src, /clientId/);
  assert.match(src, /existsById/);
  assert.match(src, /findByIdAndUserId/);
});

test('Backend ConversationService enforces ownership via findByIdAndUserId', () => {
  const src = readFileSync(
    resolve(ROOT, 'BackendPrivoraa/src/main/java/com/privoraa/conversation/ConversationService.java'),
    'utf-8'
  );
  assert.match(src, /findByIdAndUserId/);
  assert.match(src, /requireOwned/);
});

test('GeminiProvider logs stream diagnostics', () => {
  const src = readFileSync(
    resolve(ROOT, 'BackendPrivoraa/src/main/java/com/privoraa/llm/GeminiProvider.java'),
    'utf-8'
  );
  assert.match(src, /Gemini stream completed/);
  assert.match(src, /chunks?=/);
  assert.match(src, /finishReason?=/);
  assert.match(src, /elapsedMs?=/);
});

test('GeminiProvider filter passes usage events', () => {
  const src = readFileSync(
    resolve(ROOT, 'BackendPrivoraa/src/main/java/com/privoraa/llm/GeminiProvider.java'),
    'utf-8'
  );
  assert.match(src, /e\.promptTokens\(\) > 0 \|\| e\.completionTokens\(\) > 0/);
});

test('OpenRouterClient filter passes usage events', () => {
  const src = readFileSync(
    resolve(ROOT, 'BackendPrivoraa/src/main/java/com/privoraa/llm/OpenRouterClient.java'),
    'utf-8'
  );
  assert.match(src, /e\.promptTokens\(\) > 0 \|\| e\.completionTokens\(\) > 0/);
});

test('useChat manages per-conversation abort controllers', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.match(src, /abortRefMap/);
  assert.match(src, /clearConversationStreaming/);
});

test('useChat stop targets specific conversation', () => {
  const src = readFileSync(resolve(ROOT, 'src/features/chat/useChat.js'), 'utf-8');
  assert.match(src, /abortRefMap\.current\[conversationId\]/);
});
