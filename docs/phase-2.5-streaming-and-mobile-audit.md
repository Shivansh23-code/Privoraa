# Phase 2.5 — Streaming & Mobile Audit

> Historical pre-implementation audit. The active implementation now propagates provider terminal
> reasons and usage through `StreamEvent`, applies configuration-bound output budgets, and uses the
> `ChatService.StreamSession` lifecycle documented in `AI_RESPONSE_RELIABILITY.md`.

## Root-Cause Analysis: Truncated AI Responses

### The Gap

No finish-reason value is propagated from any provider through the SSE stream to the UI.
When a model stops early (context-window limit, max-tokens ceiling, content filter), the
frontend displays the partial response as if it were complete — with no warning.

### Backend Data Flow (per provider)

| Provider  | Last-stream-delta shape                                 | Finish-reason location                | Currently captured? |
| --------- | ------------------------------------------------------- | ------------------------------------- | ------------------- |
| OpenRouter| `{"choices":[{"delta":{},"finish_reason":"stop"}]}`    | `choices[0].finish_reason`            | No — `extractDelta` ignores it, `[DONE]` terminates the flux |
| Gemini    | Same as OpenRouter (OpenAI-compatible endpoint)         | `choices[0].finish_reason`            | No — same pattern   |
| Ollama    | `{"message":{"content":""},"done":true,"done_reason":"stop"}` | `done_reason`                  | No — `takeUntil` includes the done line but `mapNotNull` drops it, `done_reason` unread |

### Frontend Data Flow

| Layer          | File                   | Gap                                                              |
| -------------- | ---------------------- | ---------------------------------------------------------------- |
| SSE dispatch   | `chatService.js:182`   | `onDone` passes the entire JSON payload — but payload lacks `finishReason` |
| Chat orchestr. | `useChat.js:71-79`    | `onDone` reads only `promptTokens`, `completionTokens`, `citations`, `aborted` — no truncation field |
| Store          | `chatStore.js`         | `updateMessage` is generic — accepts any patch, no truncation field shape defined |
| Bubble render  | `MessageBubble.jsx`    | Only shows `aborted` message — no `truncated` / `finishReason` branch |

### Output-Token Budget

`ChatOptions.forCategory()` (line 32-41) intentionally sets `maxTokens = null` for all
categories with the comment "maxTokens stays null so the model finishes naturally
instead of being truncated mid-thought."  However:

- OpenRouter free models frequently have tight context windows (4k–8k total).  Without
  `max_tokens` the provider applies its own default, which may be very small — producing
  truncated answers without signalling truncation.
- Gemini free tier is similarly constrained.
- Ollama has no enforced per-request `num_predict` (it's not sent when `maxTokens` is null).

A sensible per-category output budget combined with finish-reason signalling gives
users both (a) a complete-enough default answer and (b) awareness when it was
truncated, with a path to continue.

---

## Proposed Fixes

### 1. Backend — Propagate finishReason Through the SSE Stream

**New type:** `com.privoraa.llm.StreamEvent` (record)

```java
record StreamEvent(String delta, String finishReason) {
  static StreamEvent delta(String d) { ... }
  static StreamEvent done(String reason) { ... }
}
```

Changes scope:
- `LlmProvider.streamChat()` return type: `Flux<String>` → `Flux<StreamEvent>`
- `OpenRouterClient`: emit `StreamEvent.done(reason)` on final chunk
- `GeminiProvider`: same
- `OllamaProvider`: emit `StreamEvent.done(reason)` on `done: true` line
- `ChatService.attempt()`: subscribe to `Flux<StreamEvent>`, capture `finishReason`,
  include in the SSE `done` event payload

### 2. Backend — Output-Token Budget

**File:** `ChatOptions.forCategory()`

Set `maxTokens` per category instead of `null`:

| Category    | maxTokens |
| ----------- | --------- |
| code        | 8192      |
| math        | 4096      |
| reasoning   | 4096      |
| general     | 2048      |
| fast, vision, etc. | 2048 |

### 3. Frontend — Handle finishReason in Message State

**File:** `useChat.js` `onDone` callback

Read `usage.finishReason` and write it to the message via `finalize()`.

### 4. Frontend — Truncation Warning UI

**File:** `MessageBubble.jsx`

Show a pale amber banner when `message.finishReason === 'length'`:
> "The response was truncated because it reached the length limit.
>  [Continue generating]"

The "Continue" button re-sends the same user prompt with an instruction to continue
from where it left off (future: a `continue` flag on the request).  For now "Continue"
reuses the `onRegenerate` mechanism but appends a continuation hint.

### 5. Frontend — Continue Semantics

When the user clicks "Continue", `useChat.js` should:
1. Find the partial assistant message
2. Send a new user message: "Continue from where you left off (do not repeat)."
3. The response stream appends to the EXISTING assistant message content (not a new bubble)

This requires changes to `useChat.js` to support appending to an existing bubble
rather than creating a new one.

### 6. Mobile Typography

**File:** `src/index.css` `@media (max-width: 640px)`

- Increase line-height on prose from 1.7 → 1.75 for readability
- Reduce heading margins to reclaim vertical space
- Ensure `pre` font-size is usable on small screens

### 7. Markdown Overflow

**File:** `src/index.css` `.prose-chat`

Add `overflow-x: auto` to the prose container so wide tables/code don't break layout.

### 8. Composer Clearance

**File:** `Composer.jsx`

Ensure the ResizeObserver includes the attachment preview area (images + document
chips above the form).  Currently only the outer `ref={composerRef}` div is observed.
The attachments row lives inside that div, so its height IS included — no change
needed, but verified by inspection.

Mobile keyboard: `--composer-height` is driven by ResizeObserver, which fires when
the keyboard opens and the viewport shrinks.  No additional fix needed.

---

## Non-Goals

- No changes to SSE event names (`meta`, `token`, `done`, `error`)
- No MongoDB or database migrations
- No frontend redesign
- No changes to persisted Zustand contracts
- No changes to Phase 1 classifier, Phase 1 privacy boundary, Phase 2 model registry,
  active routing, billing, auth, RAG, or the non-streaming path beyond adding
  `finishReason` to `ChatResult`
