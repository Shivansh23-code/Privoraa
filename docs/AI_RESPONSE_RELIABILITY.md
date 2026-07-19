# AI response reliability

Privoraa has one authoritative server streaming lifecycle: classify and enforce privacy, prepare the
single turn, create a `StreamSession`, run one provider segment, optionally continue after `length`,
persist one combined assistant message, and emit one final SSE `done`. Model fallback is allowed only
before the first model emits content and remains within the routed provider chain.

## Provider contracts

| Provider endpoint | Output limit field | Terminal/usage source |
| --- | --- | --- |
| Google Gemini OpenAI-compatible `/v1beta/openai/chat/completions` | `max_completion_tokens` | OpenAI-compatible `finish_reason` and streamed `usage` |
| OpenRouter `/api/v1/chat/completions` | `max_tokens` | normalized `finish_reason`, final usage chunk, then `[DONE]` |
| Ollama `/api/chat` | `options.num_predict` (`options.num_ctx` is preserved) | `done`, `done_reason`, `prompt_eval_count`, `eval_count` |

Gemini 2.5 Flash requests set supported OpenAI-compatible `reasoning_effort: none`, preventing optional
thinking from consuming the visible-answer budget. Builders send only the field for their endpoint.

## Completion and continuation

`stop` produces `completionStatus=complete`. A provider `length` result starts another segment when
enabled and within both limits. Safety/content filtering never continues. Missing terminals or provider
errors after content produce `incomplete`; user cancellation produces `aborted`; exhausting the bounded
continuation policy produces `limit_reached`.

Continuation uses the original provider/model, original prepared conversation, accumulated assistant
output, and one internal instruction. It does not repeat classification, persistence of the user turn,
RAG, or rate limiting. The internal instruction is provider context only. Exact suffix/prefix overlap is
removed conservatively within the configured window. A single atomic finalizer guards persistence and
the final `done` event.

The final payload preserves existing fields and adds `completionStatus`, `segments`, `continued`, and
`tokenCountEstimated`. `promptTokens` means total provider input usage summed across all segments, not
only the original prompt. Provider counts are authoritative; if any required count is estimated, the
payload sets `tokenCountEstimated=true`.

## Configuration

```text
CHAT_CONTINUATION_ENABLED=true
CHAT_CONTINUATION_MAX_SEGMENTS=3
CHAT_CONTINUATION_MAX_TOTAL_COMPLETION_TOKENS=16000
CHAT_CONTINUATION_OVERLAP_WINDOW_CHARS=600
CHAT_OUTPUT_LEARNING_MAX_TOKENS=6144
CHAT_OUTPUT_CODE_MAX_TOKENS=8192
CHAT_OUTPUT_UNKNOWN_MODEL_MAX_TOKENS=4096
GIT_COMMIT_SHA=<deployed SHA>              # Render also supplies RENDER_GIT_COMMIT
BUILD_TIMESTAMP=<UTC image build time>
```

## Deployment and acceptance

Build identity is safe actuator metadata: Maven build version/time plus `info.git.commit` and the supplied
build timestamp. After deployment:

```powershell
git rev-parse HEAD
docker ps
docker images
docker inspect <container>
docker logs <container> | Select-String 'Build identity|Chat output configuration|Provider request'
curl.exe https://<backend>/actuator/health
curl.exe https://<backend>/actuator/info
```

Run the authenticated arrays acceptance request with `curl -N`, save the SSE, and verify one `meta`, any
number of `token` events, at most one explanatory `model_switch`, and exactly one `done`. The final payload
must be `finishReason=stop`, `completionStatus=complete`; database inspection must show one user and one
combined assistant message for the turn. Redact credentials and never enable prompt/body logging.

Known limitation: no manual Continue endpoint is exposed after `limit_reached`. Regenerate intentionally
creates a new answer; it is not presented as continuation. Normal bounded automatic continuation is fully
server-side.
