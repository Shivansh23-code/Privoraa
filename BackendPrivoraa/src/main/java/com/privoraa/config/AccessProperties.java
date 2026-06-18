package com.privoraa.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * App-access gating. When {@code allowlist} is non-empty, only those emails may
 * register or log in (protects the shared OpenRouter quota from public use).
 * {@code proEmails} are auto-granted PRO on every auth, so the owner never has to
 * re-purchase after the in-memory store resets. Both empty = open (local dev).
 */
@ConfigurationProperties(prefix = "privoraa.access")
public record AccessProperties(List<String> allowlist, List<String> proEmails) {

    /** No allowlist configured → anyone may sign up (the dev default). */
    public boolean isOpen() {
        return norm(allowlist).isEmpty();
    }

    public boolean allows(String email) {
        return isOpen() || norm(allowlist).contains(clean(email));
    }

    public boolean isPro(String email) {
        return norm(proEmails).contains(clean(email));
    }

    private static Set<String> norm(List<String> list) {
        if (list == null) {
            return Set.of();
        }
        return list.stream().map(AccessProperties::clean).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }

    private static String clean(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }
}
