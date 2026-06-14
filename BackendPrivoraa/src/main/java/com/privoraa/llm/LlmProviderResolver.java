package com.privoraa.llm;

import com.privoraa.config.LlmProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Picks the active {@link LlmProvider} from {@code privoraa.llm.provider}, while
 * keeping both providers injectable so callers can reach OpenRouter explicitly
 * (e.g. health page) regardless of the active selection.
 */
@Component
public class LlmProviderResolver {

    private final List<LlmProvider> providers;
    private final LlmProperties props;

    public LlmProviderResolver(List<LlmProvider> providers, LlmProperties props) {
        this.providers = providers;
        this.props = props;
    }

    /** The provider selected by config. */
    public LlmProvider active() {
        return byId(props.provider());
    }

    public boolean isOllamaActive() {
        return active() instanceof OllamaProvider;
    }

    public LlmProvider byId(String id) {
        return providers.stream()
                .filter(p -> p.id().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No LLM provider with id '" + id + "'"));
    }
}
