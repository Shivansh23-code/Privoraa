package com.privoraa.ai.classification;

public record RequestClassificationInput(
        String prompt,
        String mode,
        String providerPreference,
        String modelPreference,
        boolean hasImage,
        boolean useRag,
        int approximateContextLength
) {
    public RequestClassificationInput {
        prompt = prompt == null ? "" : prompt;
        mode = mode == null ? "" : mode;
        providerPreference = providerPreference == null ? "" : providerPreference;
        modelPreference = modelPreference == null ? "" : modelPreference;
        approximateContextLength = Math.max(0, approximateContextLength);
    }
}
