package com.privoraa.ai.registry;

import com.privoraa.ai.classification.ExecutionTarget;

public final class ExecutionTargetMapper {
    private ExecutionTargetMapper() {}

    public static ExecutionTarget map(ExecutionTopology topology) {
        return switch (topology) {
            case CLOUD -> ExecutionTarget.CLOUD_PROVIDER;
            case SERVER_HOST_LOCAL -> ExecutionTarget.SERVER_SIDE_OLLAMA;
            case BROWSER_DEVICE_LOCAL -> ExecutionTarget.BROWSER_LOCAL_OLLAMA;
        };
    }
}
