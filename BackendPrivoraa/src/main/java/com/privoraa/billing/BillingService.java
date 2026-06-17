package com.privoraa.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.privoraa.auth.Plan;
import com.privoraa.auth.User;
import com.privoraa.auth.UserRepository;
import com.privoraa.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Razorpay billing. Creates orders, verifies payment signatures, and grants the
 * paid plan. Dual-mode: a plan whose configured amount is 0 is granted for free
 * (beta) without any Razorpay call; a positive amount routes through real
 * Razorpay Checkout. All plan grants funnel through {@link #applyPlan} so the
 * synchronous verify and the async webhook stay consistent.
 */
@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    private final RazorpayProperties props;
    private final UserRepository users;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newHttpClient();

    public BillingService(RazorpayProperties props, UserRepository users, ObjectMapper mapper) {
        this.props = props;
        this.users = users;
        this.mapper = mapper;
    }

    public boolean enabled() {
        return props.configured();
    }

    /**
     * Start an upgrade. Free-beta (amount 0) grants immediately; otherwise creates
     * a Razorpay order to hand to Checkout.
     */
    public CheckoutResult checkout(String userId, String plan) {
        String p = normalizePlan(plan);
        int amount = props.amountFor(p);

        if (amount <= 0) {
            applyPlan(userId, p, "free-beta");
            return CheckoutResult.granted(p);
        }
        if (!props.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Payments aren't enabled yet.");
        }
        String orderId = createRazorpayOrder(userId, p, amount);
        return CheckoutResult.order(orderId, props.keyId(), amount, props.currency(), p);
    }

    /** Verify a completed Checkout and grant the plan. Returns the granted plan. */
    public String verify(String userId, String orderId, String paymentId, String signature) {
        if (!props.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Payments aren't enabled yet.");
        }
        String expected = hmacHex(orderId + "|" + paymentId, props.keySecret());
        if (!constantTimeEquals(expected, signature)) {
            throw ApiException.badRequest("Payment signature verification failed.");
        }
        // Authoritative plan comes from the order notes, not the client.
        JsonNode order = fetchRazorpayOrder(orderId);
        JsonNode notes = order.path("notes");
        String plan = notes.path("plan").asText("PLUS");
        String orderUser = notes.path("userId").asText("");
        if (!orderUser.isEmpty() && !orderUser.equals(userId)) {
            throw ApiException.forbidden("This order belongs to another account.");
        }
        applyPlan(userId, plan, paymentId);
        return normalizePlan(plan);
    }

    /** Razorpay webhook — verify signature, then grant on a captured payment. */
    public void handleWebhook(String rawBody, String signature) {
        if (props.webhookSecret() == null || props.webhookSecret().isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Webhook not configured.");
        }
        String expected = hmacHex(rawBody, props.webhookSecret());
        if (!constantTimeEquals(expected, signature)) {
            throw ApiException.badRequest("Webhook signature verification failed.");
        }
        try {
            JsonNode event = mapper.readTree(rawBody);
            String type = event.path("event").asText("");
            if (!type.startsWith("payment.") && !type.startsWith("order.")) {
                return; // ignore non-payment events
            }
            // notes live on the entity (payment or order) inside the payload.
            JsonNode notes = event.at("/payload/payment/entity/notes");
            if (notes.isMissingNode() || notes.isEmpty(null)) {
                notes = event.at("/payload/order/entity/notes");
            }
            String userId = notes.path("userId").asText("");
            String plan = notes.path("plan").asText("");
            if (!userId.isEmpty() && !plan.isEmpty()) {
                applyPlan(userId, plan, "webhook:" + type);
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Failed to process Razorpay webhook: {}", e.getMessage());
        }
    }

    // ----------------------------------------------------------------- internals

    private void applyPlan(String userId, String plan, String ref) {
        Plan target = Plan.from(plan);
        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found."));
        user.setPlan(target);
        users.save(user);
        log.info("Granted plan {} to user {} (ref={})", target, userId, ref);
    }

    private String createRazorpayOrder(String userId, String plan, int amount) {
        ObjectNode body = mapper.createObjectNode();
        body.put("amount", amount);
        body.put("currency", props.currency());
        body.put("receipt", ("pv_" + plan + "_" + System.currentTimeMillis()));
        ObjectNode notes = body.putObject("notes");
        notes.put("userId", userId);
        notes.put("plan", plan);
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.razorpay.com/v1/orders"))
                    .header("Authorization", basicAuth())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                log.warn("Razorpay order create failed ({}): {}", resp.statusCode(), resp.body());
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not start the payment. Try again.");
            }
            return mapper.readTree(resp.body()).path("id").asText();
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not reach the payment provider.");
        }
    }

    private JsonNode fetchRazorpayOrder(String orderId) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.razorpay.com/v1/orders/" + orderId))
                    .header("Authorization", basicAuth())
                    .GET()
                    .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() / 100 != 2) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not verify the order.");
            }
            return mapper.readTree(resp.body());
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not verify the order.");
        }
    }

    private String basicAuth() {
        String creds = props.keyId() + ":" + props.keySecret();
        return "Basic " + Base64.getEncoder().encodeToString(creds.getBytes(StandardCharsets.UTF_8));
    }

    private String normalizePlan(String plan) {
        String p = plan == null ? "" : plan.trim().toUpperCase();
        if (!p.equals("PLUS") && !p.equals("PRO")) {
            throw ApiException.badRequest("Only PLUS and PRO can be purchased.");
        }
        return p;
    }

    private static String hmacHex(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] out = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(out.length * 2);
            for (byte b : out) sb.append(String.format("%02x", b & 0xFF));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC failed", e);
        }
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int r = 0;
        for (int i = 0; i < a.length(); i++) r |= a.charAt(i) ^ b.charAt(i);
        return r == 0;
    }
}
