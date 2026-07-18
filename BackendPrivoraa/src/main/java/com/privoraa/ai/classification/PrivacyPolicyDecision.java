package com.privoraa.ai.classification;

public record PrivacyPolicyDecision(boolean allowed, String code) {
    public static PrivacyPolicyDecision allow() {
        return new PrivacyPolicyDecision(true, "ALLOWED");
    }

    public static PrivacyPolicyDecision deny(String code) {
        return new PrivacyPolicyDecision(false, code);
    }
}
