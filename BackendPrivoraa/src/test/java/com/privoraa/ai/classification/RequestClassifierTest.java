package com.privoraa.ai.classification;

import com.privoraa.routing.IntentClassifier;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class RequestClassifierTest {

    private final RequestClassifier classifier = new RequestClassifier(new IntentClassifier());

    @Test
    void classifiesJavaCodingRequest() {
        RequestClassification result = classify(
                "Create a Spring Boot service method using constructor injection.", false, false);
        assertEquals(IntentType.CODING, result.intent());
        assertTrue(result.requiredCapabilities().contains(Capability.CODE));
        assertTrue(Set.of(ComplexityLevel.MEDIUM, ComplexityLevel.HIGH).contains(result.complexity()));
        assertEquals(FreshnessRequirement.STABLE, result.freshness());
        assertNotEquals(PrivacyLevel.LOCAL_ONLY, result.privacy());
    }

    @Test
    void classifiesScreenshotAsVision() {
        RequestClassification result = classify("Find the UI issue in this screenshot.", true, false);
        assertEquals(IntentType.VISION, result.intent());
        assertTrue(result.requiredCapabilities().contains(Capability.VISION));
    }

    @Test
    void classifiesCurrentNewsAsResearch() {
        RequestClassification result = classify(
                "What are the latest Java and Spring Boot releases in 2026?", false, false);
        assertEquals(IntentType.RESEARCH, result.intent());
        assertEquals(FreshnessRequirement.CURRENT_INFORMATION_REQUIRED, result.freshness());
        assertTrue(result.requiredCapabilities().contains(Capability.WEB_SEARCH));
    }

    @Test
    void privateDocumentIsLocalOnlyAndKeepsRagCapability() {
        RequestClassification result = classify(
                "Use this confidential document and do not send anything to the cloud.", false, true);
        assertEquals(IntentType.PRIVATE_LOCAL, result.intent());
        assertEquals(PrivacyLevel.LOCAL_ONLY, result.privacy());
        assertTrue(result.requiredCapabilities().containsAll(
                Set.of(Capability.RAG, Capability.LOCAL_INFERENCE)));
    }

    @Test
    void classifiesRepositoryDebugging() {
        RequestClassification result = classify(
                "Trace why this React request returns 500 through the Spring controller and repository.",
                false, false);
        assertTrue(Set.of(IntentType.DEBUGGING, IntentType.REPOSITORY_ANALYSIS).contains(result.intent()));
        assertTrue(result.requiredCapabilities().contains(Capability.CODE));
        assertTrue(result.requiredCapabilities().contains(Capability.STRONG_REASONING));
    }

    @Test
    void classifiesSimpleRewrite() {
        RequestClassification result = classify("Rewrite this message professionally.", false, false);
        assertEquals(IntentType.WRITING, result.intent());
        assertEquals(ComplexityLevel.LOW, result.complexity());
        assertEquals(FreshnessRequirement.STABLE, result.freshness());
        assertTrue(result.requiredCapabilities().contains(Capability.TEXT));
    }

    @Test
    void ambiguousRequestUsesConservativeFallback() {
        RequestClassification result = classify("Help me with this.", false, false);
        assertEquals(IntentType.GENERAL_CHAT, result.intent());
        assertEquals(ComplexityLevel.MEDIUM, result.complexity());
        assertFalse(result.requiredCapabilities().isEmpty());
        assertFalse(result.reasons().isEmpty());
        assertTrue(result.confidence() >= 0 && result.confidence() <= 1);
        assertTrue(result.reasons().contains(ClassificationReason.FALLBACK_CLASSIFICATION));
    }

    @Test
    void sensitiveTokenRaisesPrivacyWithoutIncludingTokenInReasons() {
        String token = "ghp_1234567890SuperSecretValue";
        RequestClassification result = classify("Debug access token " + token, false, false);
        assertEquals(PrivacyLevel.SENSITIVE, result.privacy());
        assertTrue(result.reasons().contains(ClassificationReason.SENSITIVE_DATA_PATTERN));
        assertFalse(result.reasons().toString().contains(token));
    }

    @Test
    void ragAlwaysAddsRagCapability() {
        assertTrue(classify("Summarize the material", false, true)
                .requiredCapabilities().contains(Capability.RAG));
    }

    @Test
    void imageAndCodeRequireBothCapabilities() {
        RequestClassification result = classify("Fix the React code shown here", true, false);
        assertTrue(result.requiredCapabilities().containsAll(Set.of(Capability.CODE, Capability.VISION)));
    }

    @Test
    void topicalOfflineWordingDoesNotBecomeLocalOnly() {
        RequestClassification result = classify("Explain offline caching in Spring.", false, false);
        assertNotEquals(IntentType.PRIVATE_LOCAL, result.intent());
        assertNotEquals(PrivacyLevel.LOCAL_ONLY, result.privacy());
    }

    @Test
    void resultDefensivelyCopiesCollectionsAndValidatesConfidence() {
        assertThrows(IllegalArgumentException.class, () -> new RequestClassification(
                IntentType.GENERAL_CHAT, ComplexityLevel.LOW, FreshnessRequirement.STABLE,
                PrivacyLevel.PUBLIC, Set.of(Capability.TEXT), 1.1, null));
        RequestClassification fallback = RequestClassification.conservativeFallback(false);
        assertThrows(UnsupportedOperationException.class,
                () -> fallback.requiredCapabilities().add(Capability.CODE));
    }

    @Test
    void teachingArraysWithJavaIsLearningWithCodeCapability() {
        RequestClassification result = classify("Teach arrays with Java examples", false, false);
        assertEquals(IntentType.LEARNING, result.intent());
        assertTrue(result.requiredCapabilities().contains(Capability.CODE));
    }

    @Test
    void fixingJavaArrayCodeIsCodingOrDebugging() {
        assertTrue(Set.of(IntentType.CODING, IntentType.DEBUGGING).contains(
                classify("Fix this Java array code", false, false).intent()));
    }

    @Test
    void implementingBinarySearchInJavaIsCoding() {
        assertEquals(IntentType.CODING,
                classify("Implement binary search in Java", false, false).intent());
    }

    @Test
    void explainingBinarySearchInJavaIsLearningWithCodeCapability() {
        RequestClassification result = classify("Explain binary search using Java", false, false);
        assertEquals(IntentType.LEARNING, result.intent());
        assertTrue(result.requiredCapabilities().contains(Capability.CODE));
    }

    private RequestClassification classify(String prompt, boolean image, boolean rag) {
        return classifier.classify(new RequestClassificationInput(
                prompt, "general", "", "auto", image, rag, prompt.length()));
    }
}
