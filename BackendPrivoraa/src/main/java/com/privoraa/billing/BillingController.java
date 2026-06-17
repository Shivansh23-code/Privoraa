package com.privoraa.billing;

import com.privoraa.auth.PrivoraaUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Billing endpoints: read config, start a checkout, verify a completed payment,
 * and receive Razorpay webhooks. The webhook is unauthenticated (Razorpay calls
 * it) and verified by signature instead.
 */
@RestController
@RequestMapping("/api/v1/billing")
@Tag(name = "Billing (Razorpay)", description = "Upgrade plans via Razorpay")
public class BillingController {

    private final BillingService billing;
    private final RazorpayProperties props;

    public BillingController(BillingService billing, RazorpayProperties props) {
        this.billing = billing;
        this.props = props;
    }

    @GetMapping("/config")
    @Operation(summary = "Whether billing is enabled, the public key, and plan amounts")
    public Map<String, Object> config() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", billing.enabled());
        out.put("keyId", props.keyId());
        out.put("currency", props.currency());
        out.put("plans", List.of(
                planInfo("PLUS", props.plusAmount()),
                planInfo("PRO", props.proAmount())));
        return out;
    }

    @PostMapping("/checkout")
    @Operation(summary = "Start an upgrade: grant free-beta plan or create a Razorpay order")
    public CheckoutResult checkout(@AuthenticationPrincipal PrivoraaUserDetails user,
                                   @RequestBody CheckoutRequest req) {
        return billing.checkout(user.getId(), req.plan());
    }

    @PostMapping("/verify")
    @Operation(summary = "Verify a completed Razorpay payment and grant the plan")
    public Map<String, String> verify(@AuthenticationPrincipal PrivoraaUserDetails user,
                                      @RequestBody VerifyRequest req) {
        String plan = billing.verify(user.getId(), req.orderId(), req.paymentId(), req.signature());
        return Map.of("plan", plan);
    }

    @PostMapping("/webhook")
    @Operation(summary = "Razorpay webhook (signature-verified, unauthenticated)")
    public Map<String, Object> webhook(@RequestBody String rawBody,
                                       @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature) {
        billing.handleWebhook(rawBody, signature);
        return Map.of("ok", true);
    }

    private Map<String, Object> planInfo(String plan, int amount) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("plan", plan);
        m.put("amount", amount);
        m.put("free", amount <= 0);
        return m;
    }

    public record CheckoutRequest(String plan) {}

    public record VerifyRequest(String orderId, String paymentId, String signature) {}
}
