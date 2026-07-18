package com.privoraa.ai.classification;

import org.springframework.stereotype.Component;

@Component
public class PrivacyPolicyEvaluator {

    public PrivacyPolicyDecision evaluate(RequestClassification classification, ExecutionTarget target) {
        if (classification.privacy() != PrivacyLevel.LOCAL_ONLY) {
            return PrivacyPolicyDecision.allow();
        }
        if (target == ExecutionTarget.BROWSER_LOCAL_OLLAMA) {
            return PrivacyPolicyDecision.allow();
        }
        return PrivacyPolicyDecision.deny(PrivacyPolicyViolationException.CODE);
    }

    public void requireAllowed(RequestClassification classification, ExecutionTarget target) {
        PrivacyPolicyDecision decision = evaluate(classification, target);
        if (!decision.allowed()) {
            throw new PrivacyPolicyViolationException(decision.code());
        }
    }
}
