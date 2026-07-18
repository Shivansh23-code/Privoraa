package com.privoraa.ai.classification;

import java.util.List;
import java.util.Objects;
import java.util.Set;

public record RequestClassification(
        IntentType intent,
        ComplexityLevel complexity,
        FreshnessRequirement freshness,
        PrivacyLevel privacy,
        Set<Capability> requiredCapabilities,
        double confidence,
        List<ClassificationReason> reasons
) {
    public RequestClassification {
        Objects.requireNonNull(intent, "intent");
        Objects.requireNonNull(complexity, "complexity");
        Objects.requireNonNull(freshness, "freshness");
        Objects.requireNonNull(privacy, "privacy");
        if (!Double.isFinite(confidence) || confidence < 0 || confidence > 1) {
            throw new IllegalArgumentException("confidence must be between 0 and 1");
        }
        requiredCapabilities = Set.copyOf(
                requiredCapabilities == null ? Set.of() : requiredCapabilities);
        reasons = List.copyOf(reasons == null ? List.of() : reasons);
    }

    public static RequestClassification conservativeFallback(boolean personal) {
        return new RequestClassification(
                IntentType.GENERAL_CHAT,
                ComplexityLevel.MEDIUM,
                FreshnessRequirement.STABLE,
                personal ? PrivacyLevel.PERSONAL : PrivacyLevel.PUBLIC,
                Set.of(Capability.TEXT),
                0.45,
                List.of(ClassificationReason.AMBIGUOUS_REQUEST,
                        ClassificationReason.FALLBACK_CLASSIFICATION));
    }
}
