package com.privoraa.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Emits only non-secret configuration/build identity needed to verify a deployment. */
@Component
public class RuntimeDiagnostics {
    private static final Logger log = LoggerFactory.getLogger(RuntimeDiagnostics.class);
    private final ChatOutputProperties output;
    private final ChatContinuationProperties continuation;
    private final Environment environment;

    public RuntimeDiagnostics(ChatOutputProperties output, ChatContinuationProperties continuation,
                              Environment environment) {
        this.output = output;
        this.continuation = continuation;
        this.environment = environment;
    }

    @PostConstruct
    void report() {
        log.info("Chat output configuration loaded: fast={} general={} learning={} code={} reasoning={} "
                        + "document={} vision={} unknownModel={} safetyMargin={}",
                output.fastMaxTokens(), output.generalMaxTokens(), output.learningMaxTokens(),
                output.codeMaxTokens(), output.reasoningMaxTokens(), output.documentMaxTokens(),
                output.visionMaxTokens(), output.unknownModelMaxTokens(), output.safetyMargin());
        log.info("Chat continuation configuration loaded: enabled={} maxSegments={} "
                        + "maxTotalCompletionTokens={} overlapWindowChars={}",
                continuation.enabled(), continuation.maxSegments(),
                continuation.maxTotalCompletionTokens(), continuation.overlapWindowChars());
        log.info("Build identity: version={} gitCommit={} buildTimestamp={}",
                environment.getProperty("info.app.version", "unknown"),
                environment.getProperty("info.git.commit", "unknown"),
                environment.getProperty("info.app.build-timestamp", "unknown"));
    }
}
