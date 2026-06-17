package com.privoraa.billing;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Razorpay billing config. When {@code keyId}/{@code keySecret} are unset the whole
 * billing flow is inert (the endpoints report disabled), so the deploy is never
 * broken by missing keys. Amounts are in the smallest currency unit (paise for
 * INR); an amount of 0 means "free beta" — the plan is granted without a charge.
 */
@ConfigurationProperties(prefix = "privoraa.billing")
public record RazorpayProperties(
        String keyId,
        String keySecret,
        String webhookSecret,
        String currency,
        int plusAmount,
        int proAmount
) {
    public RazorpayProperties {
        if (currency == null || currency.isBlank()) {
            currency = "INR";
        }
    }

    /** Real Razorpay calls are possible only when both keys are present. */
    public boolean configured() {
        return keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank();
    }

    /** Amount (smallest unit) for a plan; 0 ⇒ free beta. */
    public int amountFor(String plan) {
        return "PRO".equalsIgnoreCase(plan) ? proAmount : plusAmount;
    }
}
