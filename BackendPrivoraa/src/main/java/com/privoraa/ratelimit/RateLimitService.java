package com.privoraa.ratelimit;

import com.privoraa.common.RateLimitException;
import com.privoraa.config.RateLimitProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

/**
 * Per-user token bucket on Redis (per-minute and per-day windows). Designed to
 * stay at/under OpenRouter's free-tier limits so we degrade gracefully instead of
 * triggering upstream 429s. Fails OPEN: if Redis is unreachable, requests pass.
 */
@Service
public class RateLimitService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitService.class);

    private final StringRedisTemplate redis;
    private final RateLimitProperties props;

    public RateLimitService(StringRedisTemplate redis, RateLimitProperties props) {
        this.redis = redis;
        this.props = props;
    }

    /** Consume one request; throws {@link RateLimitException} when over budget. */
    public void check(String userId) {
        try {
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
        } catch (RateLimitException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Rate limiter unavailable, failing open: {}", e.getMessage());
        }
    }
}
