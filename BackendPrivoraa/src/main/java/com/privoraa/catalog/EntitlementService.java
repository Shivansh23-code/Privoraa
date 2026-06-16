package com.privoraa.catalog;

import com.privoraa.auth.Plan;
import com.privoraa.auth.UserRepository;
import org.springframework.stereotype.Service;

/**
 * Resolves a user's subscription {@link Plan} and decides whether they may
 * download a given catalog model. Reads the model's required plan from the
 * curated catalog; an unknown tag (custom pull) is treated as FREE so it stays
 * allowed. This is the single enforcement point the download path calls.
 */
@Service
public class EntitlementService {

    private final UserRepository users;
    private final OllamaCatalogService catalog;

    public EntitlementService(UserRepository users, OllamaCatalogService catalog) {
        this.users = users;
        this.catalog = catalog;
    }

    /** The user's plan; missing user or null plan ⇒ FREE. */
    public Plan planOf(String userId) {
        if (userId == null) return Plan.FREE;
        return users.findById(userId)
                .map(u -> u.getPlan() == null ? Plan.FREE : u.getPlan())
                .orElse(Plan.FREE);
    }

    /** The plan a model requires; unknown tag ⇒ FREE (open). */
    public Plan requiredFor(String tag) {
        if (tag == null) return Plan.FREE;
        String normalized = OllamaCatalogService.normalize(tag);
        return catalog.raw().categories().stream()
                .flatMap(c -> c.models().stream())
                .filter(m -> OllamaCatalogService.normalize(m.tag()).equals(normalized))
                .findFirst()
                .map(m -> Plan.from(m.plan()))
                .orElse(Plan.FREE);
    }

    /** True if the user's plan is entitled to download {@code tag}. */
    public boolean canDownload(String userId, String tag) {
        return planOf(userId).allows(requiredFor(tag));
    }
}
