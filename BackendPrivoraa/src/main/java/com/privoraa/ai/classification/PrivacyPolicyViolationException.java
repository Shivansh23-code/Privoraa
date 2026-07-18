package com.privoraa.ai.classification;

public class PrivacyPolicyViolationException extends RuntimeException {

    public static final String CODE = "LOCAL_ONLY_EXECUTION_UNAVAILABLE";
    public static final String USER_MESSAGE =
            "This request is marked local-only, but no browser-local execution path is available "
                    + "through the server. Choose an installed local model in Privoraa or remove the "
                    + "local-only restriction.";

    private final String code;

    public PrivacyPolicyViolationException(String code) {
        super(USER_MESSAGE);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
