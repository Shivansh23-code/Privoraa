package com.privoraa.ai.classification;

/** Distinguishes server-hosted Ollama from inference on the end user's browser device. */
public enum ExecutionTarget {
    CLOUD_PROVIDER,
    SERVER_SIDE_OLLAMA,
    BROWSER_LOCAL_OLLAMA
}
