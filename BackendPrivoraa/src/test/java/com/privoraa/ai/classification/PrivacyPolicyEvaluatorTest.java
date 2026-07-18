package com.privoraa.ai.classification;

import com.privoraa.routing.IntentClassifier;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PrivacyPolicyEvaluatorTest {

    private final RequestClassifier classifier = new RequestClassifier(new IntentClassifier());
    private final PrivacyPolicyEvaluator policy = new PrivacyPolicyEvaluator();

    @Test
    void explicitLocalOnlyWithCloudSelectionIsRejected() {
        RequestClassification request = classify("Do not send this to the cloud", "openrouter");
        assertThrows(PrivacyPolicyViolationException.class,
                () -> policy.requireAllowed(request, ExecutionTarget.CLOUD_PROVIDER));
    }

    @Test
    void localOnlyWithServerOllamaIsRejectedByDefault() {
        RequestClassification request = classify("Use Ollama only", "ollama");
        assertFalse(policy.evaluate(request, ExecutionTarget.SERVER_SIDE_OLLAMA).allowed());
    }

    @Test
    void localOnlyAllowsOnlyBrowserLocalOllama() {
        RequestClassification request = classify("Never leave my device", "offline");
        assertTrue(policy.evaluate(request, ExecutionTarget.BROWSER_LOCAL_OLLAMA).allowed());
    }

    @Test
    void publicRequestCanUseCloud() {
        RequestClassification request = classify("Explain dependency injection", "openrouter");
        assertTrue(policy.evaluate(request, ExecutionTarget.CLOUD_PROVIDER).allowed());
    }

    private RequestClassification classify(String prompt, String provider) {
        return classifier.classify(new RequestClassificationInput(
                prompt, "general", provider, "auto", false, false, prompt.length()));
    }
}
