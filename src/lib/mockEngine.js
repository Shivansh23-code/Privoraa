// Local mock that simulates the backend's SSE chat stream so the workspace is
// fully demoable before the Spring Boot service exists. Picks a canned, richly
// formatted answer based on the routed category, then streams it token-by-token.

const SAMPLES = {
  code: `Here's a clean, idiomatic implementation with notes on the trade-offs.

\`\`\`java
@RestController
@RequestMapping("/api/v1/chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@Valid @RequestBody ChatRequest req) {
        return chatService.stream(req); // tokens pushed as they arrive
    }
}
\`\`\`

**Why this shape**

- \`SseEmitter\` keeps the controller in MVC land — no need for full WebFlux.
- \`@Valid\` enforces DTO constraints (max message length) before any upstream call.
- Streaming starts immediately, so **first-token latency** stays low.

> Time complexity is dominated by the model call, not the handler — keep the controller thin.`,

  reasoning: `Let's work through it **step by step**.

**Concept.** We want the probability of at least one success in $n$ independent trials, each with success probability $p$. It's easiest via the complement.

**Step 1 — complement.**
$$P(\\text{at least one}) = 1 - P(\\text{none}) = 1 - (1 - p)^n$$

**Step 2 — substitute** $p = 0.2,\\; n = 5$:
$$1 - (0.8)^5 = 1 - 0.32768 = 0.67232$$

**Answer.** $\\approx 0.672$, so about a **67.2%** chance.

**Practice.** What if $p = 0.1$ and $n = 10$? (Set up the complement the same way.)`,

  math: `**Solve** $\\displaystyle \\int_0^1 x e^{x}\\,dx$.

**Assumption.** Standard integration by parts, $\\int u\\,dv = uv - \\int v\\,du$.

**Step 1.** Let $u = x,\\; dv = e^x dx \\Rightarrow du = dx,\\; v = e^x$.

**Step 2.**
$$\\int x e^x dx = x e^x - \\int e^x dx = x e^x - e^x = (x-1)e^x$$

**Step 3 — evaluate** $[(x-1)e^x]_0^1$:
$$(1-1)e^1 - (0-1)e^0 = 0 - (-1) = 1$$

**Verify.** $\\frac{d}{dx}[(x-1)e^x] = e^x + (x-1)e^x = x e^x$. ✓

**Answer.** $\\boxed{1}$`,

  general: `Great question — here's the short version, then the detail.

**In one line:** route every model call through your own backend so the API key never reaches the browser.

A few things worth knowing:

1. **Security** — the OpenRouter key lives only in server env vars.
2. **Control** — you can add rate limiting, caching and a fallback chain.
3. **Talking points** — JWT auth, SSE streaming and Redis all become real.

Want me to expand any of these into a deeper explanation?`,

  fast: `Sure! Here's a quick take:

- It works, and it's the right default.
- Keep the key server-side.
- Stream tokens over SSE for that snappy feel.

Ask me to go deeper on any point. 🙂`,

  multilingual: `Of course — here's a concise, friendly answer.

This workspace can switch languages on demand and route multilingual prompts to a larger model. Tell me which language you'd like, and we'll continue there.`,
};

const RAG_PREFIX = `Based on your uploaded notes:

`;

const RAG_CITATIONS = [
  { chunk: 3, doc: 'syllabus.pdf', snippet: 'Unit 2 covers integration techniques including by-parts…' },
  { chunk: 7, doc: 'syllabus.pdf', snippet: 'Probability: complement rule and independent trials…' },
];

function tokenize(text) {
  // Split keeping whitespace so reassembly is exact.
  return text.match(/\S+\s*|\s+/g) || [text];
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    }
  });

/**
 * Simulate a streaming chat completion.
 * Mirrors chatService.streamChat's callback contract.
 */
export async function mockStreamChat(
  { category, modelName, useRag },
  { onMeta, onToken, onDone, onError, signal }
) {
  try {
    await sleep(280, signal); // "thinking" before first token

    onMeta?.({
      model: modelName,
      category,
      reason: useRag ? 'Grounded on your notes' : undefined,
      citations: useRag ? RAG_CITATIONS : undefined,
    });

    let body = SAMPLES[category] || SAMPLES.general;
    if (useRag) body = RAG_PREFIX + body + '\n\n*Sources: [3], [7] from syllabus.pdf*';

    const tokens = tokenize(body);
    let completionTokens = 0;
    for (const tok of tokens) {
      await sleep(14 + Math.min(40, tok.length * 6), signal);
      completionTokens += 1;
      onToken?.(tok);
    }

    onDone?.({
      model: modelName,
      promptTokens: 24,
      completionTokens,
      citations: useRag ? RAG_CITATIONS : undefined,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      onDone?.({ model: modelName, aborted: true });
    } else {
      onError?.(err);
    }
  }
}
