package com.privoraa.ai.registry;

import com.fasterxml.jackson.databind.JsonNode;
import com.privoraa.ai.classification.Capability;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

@Component
public class ModelCapabilityNormalizer {

    public Set<Capability> normalize(String id, String name, String category, JsonNode providerMetadata,
                                     ExecutionTopology topology) {
        String signals = ((id == null ? "" : id) + " " + (name == null ? "" : name)
                + " " + (category == null ? "" : category)).toLowerCase(Locale.ROOT);
        EnumSet<Capability> out = EnumSet.noneOf(Capability.class);
        if (!signals.contains("embed")) out.add(Capability.TEXT);
        if (signals.contains("code") || signals.contains("coder")) out.add(Capability.CODE);
        if (signals.contains("vision") || signals.contains("llava") || signals.contains("moondream")
                || contains(providerMetadata, "image")) out.add(Capability.VISION);
        if (signals.contains("reason") || signals.contains("deepseek-r1") || signals.contains("qwq"))
            out.add(Capability.STRONG_REASONING);
        if (signals.contains("flash") || signals.contains("mini") || signals.contains("1b"))
            out.add(Capability.FAST_RESPONSE);
        if (topology != ExecutionTopology.CLOUD) out.add(Capability.LOCAL_INFERENCE);
        if (hasSupportedParameter(providerMetadata, "tools")) out.add(Capability.TOOL_CALLING);
        if (hasSupportedParameter(providerMetadata, "response_format")) out.add(Capability.STRUCTURED_OUTPUT);
        return Set.copyOf(out);
    }

    private boolean contains(JsonNode node, String value) {
        return node != null && node.toString().toLowerCase(Locale.ROOT).contains(value);
    }

    private boolean hasSupportedParameter(JsonNode node, String value) {
        if (node == null) return false;
        for (JsonNode parameter : node.path("supported_parameters")) {
            if (value.equalsIgnoreCase(parameter.asText())) return true;
        }
        return false;
    }
}
