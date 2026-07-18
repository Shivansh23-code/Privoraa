package com.privoraa.ai.registry;

import com.privoraa.ai.classification.Capability;
import com.privoraa.ai.classification.PrivacyPolicyEvaluator;
import com.privoraa.ai.classification.RequestClassification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class ModelRegistry {
    private static final Logger log = LoggerFactory.getLogger(ModelRegistry.class);

    private final List<ProviderModelAdapter> adapters;
    private final ModelRegistryProperties properties;
    private final PrivacyPolicyEvaluator privacyPolicy;
    private final AtomicReference<ModelRegistrySnapshot> snapshot;

    public ModelRegistry(List<ProviderModelAdapter> adapters, ModelRegistryProperties properties,
                         PrivacyPolicyEvaluator privacyPolicy) {
        this.adapters = List.copyOf(adapters);
        this.properties = properties;
        this.privacyPolicy = privacyPolicy;
        this.snapshot = new AtomicReference<>(fallbackSnapshot());
    }

    public ModelRegistrySnapshot currentSnapshot() { return snapshot.get(); }

    public Optional<ModelDescriptor> find(String registryId) {
        return Optional.ofNullable(snapshot.get().modelsById().get(registryId));
    }

    public List<ModelDescriptor> byProvider(ModelProvider provider) {
        return snapshot.get().models().stream().filter(m -> m.provider() == provider).toList();
    }

    public List<ModelDescriptor> withCapability(Capability capability) {
        return snapshot.get().models().stream()
                .filter(m -> m.capabilities().contains(capability)).toList();
    }

    public List<ModelDescriptor> byPricing(PricingTier pricing) {
        return snapshot.get().models().stream().filter(m -> m.pricingTier() == pricing).toList();
    }

    /** Diagnostic candidate query only; active routing remains legacy until Phase 3. */
    public List<ModelDescriptor> compatibleModels(RequestClassification classification) {
        return snapshot.get().models().stream()
                .filter(ModelDescriptor::selectable)
                .filter(m -> m.capabilities().containsAll(classification.requiredCapabilities().stream()
                        .filter(c -> c != Capability.WEB_SEARCH && c != Capability.RAG).toList()))
                .filter(m -> privacyPolicy.evaluate(classification, ExecutionTargetMapper.map(m.topology())).allowed())
                .toList();
    }

    @EventListener(ApplicationReadyEvent.class)
    @Async
    public void refreshAfterStartup() { if (properties.enabled()) refresh(); }

    @Scheduled(fixedDelayString = "${privoraa.ai.registry.refresh-interval:PT1H}")
    public void scheduledRefresh() { if (properties.enabled()) refresh(); }

    public synchronized ModelRegistrySnapshot refresh() {
        ModelRegistrySnapshot previous = snapshot.get();
        Map<ModelProvider, RegistryRefreshResult> results = new EnumMap<>(ModelProvider.class);
        Map<ModelProvider, List<ModelDescriptor>> nextByProvider = group(previous.models());

        for (ProviderModelAdapter adapter : adapters) {
            long started = System.nanoTime();
            RegistryRefreshResult result;
            try {
                result = CompletableFuture.supplyAsync(adapter::refresh)
                        .orTimeout(properties.refreshTimeout().toMillis(), TimeUnit.MILLISECONDS).join();
            } catch (Exception ex) {
                result = RegistryRefreshResult.failure(adapter.provider(), RegistryReasonCode.CATALOGUE_TIMEOUT);
            }
            if (result.successful() && !result.models().isEmpty()) {
                nextByProvider.put(adapter.provider(), applySelectablePolicy(result.models()));
            } else if (!nextByProvider.containsKey(adapter.provider()) || nextByProvider.get(adapter.provider()).isEmpty()) {
                nextByProvider.put(adapter.provider(), applySelectablePolicy(adapter.fallbackModels()));
                result = new RegistryRefreshResult(adapter.provider(), false, nextByProvider.get(adapter.provider()),
                        RegistrySource.STATIC_FALLBACK, RegistryReasonCode.STATIC_FALLBACK_USED, 0);
            } else {
                result = new RegistryRefreshResult(adapter.provider(), false, nextByProvider.get(adapter.provider()),
                        RegistrySource.LAST_KNOWN_GOOD, RegistryReasonCode.LAST_KNOWN_GOOD_USED, result.malformedEntries());
            }
            results.put(adapter.provider(), result);
            log.info("Model registry refresh provider={} success={} models={} source={} reason={} durationMs={}",
                    adapter.provider(), result.successful(), nextByProvider.get(adapter.provider()).size(),
                    result.source(), result.reason(), (System.nanoTime() - started) / 1_000_000);
        }

        LinkedHashMap<String, ModelDescriptor> indexed = new LinkedHashMap<>();
        nextByProvider.values().forEach(list -> list.forEach(model -> indexed.put(model.registryId(), model)));
        ModelRegistrySnapshot updated = new ModelRegistrySnapshot(Instant.now(), indexed, results);
        snapshot.set(updated);
        return updated;
    }

    private ModelRegistrySnapshot fallbackSnapshot() {
        LinkedHashMap<String, ModelDescriptor> indexed = new LinkedHashMap<>();
        EnumMap<ModelProvider, RegistryRefreshResult> results = new EnumMap<>(ModelProvider.class);
        for (ProviderModelAdapter adapter : adapters) {
            List<ModelDescriptor> fallback = applySelectablePolicy(adapter.fallbackModels());
            fallback.forEach(model -> indexed.put(model.registryId(), model));
            results.put(adapter.provider(), new RegistryRefreshResult(adapter.provider(), false, fallback,
                    RegistrySource.STATIC_FALLBACK, RegistryReasonCode.STATIC_FALLBACK_USED, 0));
        }
        return new ModelRegistrySnapshot(Instant.now(), indexed, results);
    }

    private List<ModelDescriptor> applySelectablePolicy(List<ModelDescriptor> models) {
        List<ModelDescriptor> out = new ArrayList<>();
        for (ModelDescriptor m : models) {
            boolean selectable = m.selectable() && (m.pricingTier() != PricingTier.PAID || properties.includePaid());
            out.add(new ModelDescriptor(m.registryId(), m.provider(), m.providerModelId(), m.displayName(),
                    m.topology(), m.availability(), m.pricingTier(), m.capabilities(), m.contextWindow(),
                    m.maxOutputTokens(), m.streamingSupported(), selectable, m.source(), m.observedAt(), m.metadata()));
        }
        return List.copyOf(out);
    }

    private Map<ModelProvider, List<ModelDescriptor>> group(List<ModelDescriptor> models) {
        Map<ModelProvider, List<ModelDescriptor>> grouped = new EnumMap<>(ModelProvider.class);
        for (ModelProvider provider : ModelProvider.values()) {
            grouped.put(provider, models.stream().filter(m -> m.provider() == provider).toList());
        }
        return grouped;
    }
}
