package com.privoraa.llm;

import com.privoraa.config.LlmProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Reports whether the active LLM backend is reachable. The frontend uses this on
 * first run: if Ollama isn't installed/running it shows a guided setup card
 * instead of an empty catalog.
 */
@RestController
@RequestMapping("/api/llm")
public class LlmHealthController {

    private final LlmProviderResolver resolver;
    private final LlmProperties props;

    public LlmHealthController(LlmProviderResolver resolver, LlmProperties props) {
        this.resolver = resolver;
        this.props = props;
    }

    /** {@code GET /api/llm/health} -> {provider, ollamaInstalled, running, version}. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        LlmProvider active = resolver.active();
        ProviderHealth h = active.health();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("provider", props.provider());
        out.put("ollamaInstalled", h.installed());
        out.put("running", h.running());
        out.put("version", h.version());
        return out;
    }
}
