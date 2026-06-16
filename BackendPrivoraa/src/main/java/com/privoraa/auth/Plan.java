package com.privoraa.auth;

/**
 * Subscription tier. Gates which catalog models a user may download.
 * Ordered by {@code rank} so a higher tier is entitled to everything below it
 * (PRO ⊇ PLUS ⊇ FREE).
 */
public enum Plan {
    FREE(0),
    PLUS(1),
    PRO(2);

    private final int rank;

    Plan(int rank) {
        this.rank = rank;
    }

    /** True if this plan is entitled to content that requires {@code required}. */
    public boolean allows(Plan required) {
        return this.rank >= required.rank;
    }

    /** A user-facing label for badges/CTAs ("Free", "Plus", "Pro"). */
    public String label() {
        return name().charAt(0) + name().substring(1).toLowerCase();
    }

    /**
     * Parse a catalog model's {@code plan} string. Null / blank / unknown ⇒ FREE,
     * so an un-tagged model stays open to everyone (fail-open for browsing; the
     * download path still enforces the real value).
     */
    public static Plan from(String value) {
        if (value == null || value.isBlank()) return FREE;
        try {
            return Plan.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return FREE;
        }
    }
}
