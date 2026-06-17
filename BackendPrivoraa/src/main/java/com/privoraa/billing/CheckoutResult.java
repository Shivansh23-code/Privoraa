package com.privoraa.billing;

/**
 * Outcome of starting an upgrade. {@code granted} = free-beta plan applied with no
 * payment (the client just refreshes). Otherwise the Razorpay order fields are set
 * and the client opens Checkout.
 */
public record CheckoutResult(
        boolean granted,
        String plan,
        String orderId,
        String keyId,
        Integer amount,
        String currency
) {
    public static CheckoutResult granted(String plan) {
        return new CheckoutResult(true, plan, null, null, null, null);
    }

    public static CheckoutResult order(String orderId, String keyId, int amount, String currency, String plan) {
        return new CheckoutResult(false, plan, orderId, keyId, amount, currency);
    }
}
