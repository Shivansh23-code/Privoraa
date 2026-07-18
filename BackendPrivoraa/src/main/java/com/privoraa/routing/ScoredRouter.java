package com.privoraa.routing;

import com.privoraa.ai.classification.Capability;
import com.privoraa.ai.classification.RequestClassification;
import com.privoraa.ai.registry.ExecutionTopology;
import com.privoraa.ai.registry.ModelDescriptor;
import com.privoraa.ai.registry.ModelProvider;
import com.privoraa.ai.registry.ModelRegistry;
import com.privoraa.ai.registry.ModelRegistryProperties;
import com.privoraa.ai.registry.PricingTier;
import com.privoraa.ai.registry.RegistrySource;
import com.privoraa.ai.registry.ScoredCandidate;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.config.GeminiProperties;
import com.privoraa.llm.LlmProvider;
import com.privoraa.llm.LlmProviderResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
public class ScoredRouter {

    private static final Logger log = LoggerFactory.getLogger(ScoredRouter.class);
    private static final int MAX_CHAIN = 6;

    private final ModelRegistry registry;
    private final ModelRegistryProperties registryProperties;
    private final GeminiProperties geminiProperties;
    private final LlmProviderResolver providers;

    public ScoredRouter(ModelRegistry registry, ModelRegistryProperties registryProperties,
                        GeminiProperties geminiProperties, LlmProviderResolver providers) {
        this.registry = registry;
        this.registryProperties = registryProperties;
        this.geminiProperties = geminiProperties;
        this.providers = providers;
    }

    public boolean appliesTo(ChatRequest req, LlmProvider resolvedProvider) {
        if (!registryProperties.enabled()) return false;
        if (!registryProperties.routingEnabled()) return false;
        if ("ollama".equals(resolvedProvider.id())) return false;
        if (!isAuto(req.model())) return false;
        return true;
    }

    /**
     * Primary entry point: rank compatible models and return the best chain.
     * Throws {@link ScoredRoutingException} if no suitable model is found.
     */
    public ScoredRoutingResult resolve(RequestClassification classification, ChatRequest req,
                                        LlmProvider resolvedProvider) {
        boolean includePaid = registryProperties.includePaid();

        List<ModelDescriptor> compatible = registry.compatibleModels(classification);
        List<ModelDescriptor> candidates = filterPricing(compatible, includePaid);
        List<ScoredCandidate> scored = scoreAndSort(candidates, classification);

        if (geminiProperties.configured() && classification.requiredCapabilities().contains(Capability.CODE)) {
            scored = promoteGemini(scored);
        }

        if (scored.isEmpty()) {
            throw new ScoredRoutingException("No suitable model found for request classification");
        }

        return buildResult(scored, classification);
    }

    public void dryRun(RequestClassification classification, ChatRequest req,
                       LlmProvider resolvedProvider, Routed legacyRouted) {
        if (!registryProperties.enabled()) return;
        if (!registryProperties.dryRun()) return;
        try {
            ScoredRoutingResult wouldHave = resolve(classification, req, resolvedProvider);
            boolean sameModel = wouldHave != null
                    && wouldHave.providerModelId().equals(legacyRouted.modelId());
            log.debug("Dry-run: intent={} capabilities={} privacy={} legacyModel={} wouldSelect={} "
                            + "disagreement={} chain={}",
                    classification.intent(), classification.requiredCapabilities(),
                    classification.privacy(), legacyRouted.modelId(),
                    wouldHave != null ? wouldHave.providerModelId() : "none",
                    !sameModel,
                    wouldHave != null ? wouldHave.chain() : List.of());
        } catch (ScoredRoutingException e) {
            log.debug("Dry-run: no scored route: {}", e.getMessage());
        } catch (Exception e) {
            log.debug("Dry-run: could not compute scored route: {}", e.getMessage());
        }
    }

    private List<ModelDescriptor> filterPricing(List<ModelDescriptor> models, boolean includePaid) {
        return models.stream()
                .filter(m -> {
                    if (m.pricingTier() == PricingTier.PAID) return includePaid;
                    if (m.pricingTier() == PricingTier.UNKNOWN) return false;
                    return true;
                })
                .toList();
    }

    private List<ScoredCandidate> scoreAndSort(List<ModelDescriptor> models,
                                                RequestClassification classification) {
        return models.stream()
                .map(m -> new ScoredCandidate(m, score(m, classification)))
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    private int score(ModelDescriptor m, RequestClassification classification) {
        int score = 0;
        score += switch (m.pricingTier()) {
            case FREE -> 100;
            case LOCAL -> 80;
            case PAID -> 40;
            case UNKNOWN -> 0;
        };
        long matched = classification.requiredCapabilities().stream()
                .filter(c -> c != Capability.WEB_SEARCH && c != Capability.RAG)
                .filter(m.capabilities()::contains)
                .count();
        score += (int) matched * 10;
        score += switch (m.source()) {
            case "LIVE_CATALOGUE" -> 10;
            case "LAST_KNOWN_GOOD" -> 5;
            case "STATIC_FALLBACK" -> 2;
            case "CONFIGURATION" -> 1;
            default -> 2;
        };
        if (m.contextWindow() != null && m.contextWindow() >= 8000) {
            score += 5;
        }
        return score;
    }

    /** Promote Gemini for coding requests: produces a Gemini-only chain. */
    private List<ScoredCandidate> promoteGemini(List<ScoredCandidate> candidates) {
        if (!candidates.isEmpty() && candidates.getFirst().descriptor().provider() == ModelProvider.GEMINI) {
            return candidates;
        }

        ModelDescriptor codeDesc = registry.find("gemini:" + geminiProperties.codeModel()).orElse(null);
        if (codeDesc == null) {
            return candidates;
        }

        List<ScoredCandidate> geminiOnly = new ArrayList<>();
        geminiOnly.add(new ScoredCandidate(codeDesc, Integer.MAX_VALUE));

        if (geminiProperties.fallbackModel() != null && !geminiProperties.fallbackModel().isBlank()) {
            ModelDescriptor fallbackDesc = registry.find("gemini:" + geminiProperties.fallbackModel()).orElse(null);
            if (fallbackDesc != null && !fallbackDesc.registryId().equals(codeDesc.registryId())) {
                geminiOnly.add(new ScoredCandidate(fallbackDesc, 0));
            }
        }

        return geminiOnly;
    }

    private ScoredRoutingResult buildResult(List<ScoredCandidate> scored,
                                             RequestClassification classification) {
        ModelProvider chainProvider = scored.getFirst().descriptor().provider();

        Set<String> seen = new LinkedHashSet<>();
        List<String> chain = new ArrayList<>();
        for (ScoredCandidate c : scored) {
            if (chain.size() >= MAX_CHAIN) break;
            if (c.descriptor().provider() != chainProvider) continue;
            String pid = c.descriptor().providerModelId();
            if (seen.add(pid)) {
                chain.add(pid);
            }
        }

        ModelDescriptor top = scored.getFirst().descriptor();
        String category = mapCategory(classification);
        String reason = "Scored routing: " + top.pricingTier().name().toLowerCase()
                + " " + category + " via " + top.displayName();

        return new ScoredRoutingResult(
                top.registryId(),
                top.providerModelId(),
                top.displayName(),
                category,
                reason,
                List.copyOf(chain),
                top.provider(),
                top.pricingTier(),
                top.topology(),
                top.source()
        );
    }

    private static String mapCategory(RequestClassification classification) {
        return switch (classification.intent()) {
            case CODING, REPOSITORY_ANALYSIS, DEBUGGING, ARCHITECTURE -> "code";
            case LEARNING, RESEARCH -> "reasoning";
            case VISION -> "vision";
            case DATA_ANALYSIS, DOCUMENT_QA, WRITING -> "general";
            default -> "general";
        };
    }

    private static boolean isAuto(String model) {
        return model == null || model.isBlank() || "auto".equalsIgnoreCase(model);
    }
}
