package com.privoraa.ratelimit;

import com.privoraa.common.RateLimitException;
import com.privoraa.config.RateLimitProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-user token bucket (per-minute and per-day windows) to stay under
 * OpenRouter's free-tier limits. Uses Redis when available; on a deploy with no
 * Redis (e.g. Render free) it transparently falls back to an in-memory limiter —
 * logging once rather than warning on every request.
 */
@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);

    private final StringRedisTemplate redis;
    private final RateLimitProperties props;

    // In-memory fallback: userId -> [windowEpoch, count]. Bounded by active users.
    private volatile Boolean redisOk = null; // null = untried, false = down -> in-memory
    private final Map<String, long[]> minuteBuckets = new ConcurrentHashMap<>();
    private final Map<String, long[]> dayBuckets = new ConcurrentHashMap<>();

    public RateLimitService(StringRedisTemplate redis, RateLimitProperties props) {
        this.redis = redis;
        this.props = props;
    }

    /** Consume one request; throws {@link RateLimitException} when over budget. */
    public void check(String userId) {
        if (redisOk == null || redisOk) {
            try {
                checkRedis(userId);
                redisOk = Boolean.TRUE;
                return;
            } catch (RateLimitException e) {
                throw e;
            } catch (Exception e) {
                if (redisOk == null || redisOk) {
                    redisOk = Boolean.FALSE;
                    log.warn("Redis unavailable — using in-memory rate limiting ({}).", e.getMessage());
                }
            }
        }
        checkInMemory(userId);
    }

    private void checkRedis(String userId) {
        long now = Instant.now().getEpochSecond();

        String minuteKey = "rl:m:" + userId + ":" + (now / 60);
        Long perMinute = redis.opsForValue().increment(minuteKey);
        if (perMinute != null && perMinute == 1L) {
            redis.expire(minuteKey, Duration.ofSeconds(60));
        }
        if (perMinute != null && perMinute > props.requestsPerMin()) {
            throw new RateLimitException("Too many requests — slow down a moment.", 60 - (now % 60));
        }

        String dayKey = "rl:d:" + userId + ":" + (now / 86400);
        Long perDay = redis.opsForValue().increment(dayKey);
        if (perDay != null && perDay == 1L) {
            redis.expire(dayKey, Duration.ofDays(1));
        }
        if (perDay != null && perDay > props.requestsPerDay()) {
            throw new RateLimitException("Daily limit reached. Try again tomorrow.", 86400 - (now % 86400));
        }
    }

    private void checkInMemory(String userId) {
        long now = Instant.now().getEpochSecond();
        if (hit(minuteBuckets, userId, now / 60) > props.requestsPerMin()) {
            throw new RateLimitException("Too many requests — slow down a moment.", 60 - (now % 60));
        }
        if (hit(dayBuckets, userId, now / 86400) > props.requestsPerDay()) {
            throw new RateLimitException("Daily limit reached. Try again tomorrow.", 86400 - (now % 86400));
        }
    }

    /** Atomically count this hit within the current window, resetting on rollover. */
    private static long hit(Map<String, long[]> buckets, String userId, long window) {
        return buckets.compute(userId, (k, v) ->
                (v == null || v[0] != window) ? new long[]{window, 1} : new long[]{window, v[1] + 1})[1];
    }
}
