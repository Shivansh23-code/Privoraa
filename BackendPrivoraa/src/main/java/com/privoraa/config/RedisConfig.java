package com.privoraa.config;

import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * Redis wiring. Caching is fail-open: if Redis is unreachable, cache operations
 * are logged and skipped so the app keeps serving (just without the cache).
 */
@Configuration
public class RedisConfig implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(RedisConfig.class);

    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory cf) {
        return new StringRedisTemplate(cf);
    }

    /** Cache the model catalog with a TTL (applies only when the Redis cache manager is active). */
    @Bean
    public RedisCacheManagerBuilderCustomizer modelsCacheCustomizer(
            com.privoraa.config.OpenRouterProperties props) {
        return builder -> builder.withCacheConfiguration("models",
                RedisCacheConfiguration.defaultCacheConfig()
                        .entryTtl(Duration.ofMinutes(props.modelsCacheTtlMin())));
    }

    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(@NonNull RuntimeException ex, @NonNull org.springframework.cache.Cache cache, @NonNull Object key) {
                log.warn("Cache GET failed ({}), proceeding without cache: {}", cache.getName(), ex.getMessage());
            }
            @Override
            public void handleCachePutError(@NonNull RuntimeException ex, @NonNull org.springframework.cache.Cache cache, @NonNull Object key, Object value) {
                log.warn("Cache PUT failed ({}): {}", cache.getName(), ex.getMessage());
            }
            @Override
            public void handleCacheEvictError(@NonNull RuntimeException ex, @NonNull org.springframework.cache.Cache cache, @NonNull Object key) {
                log.warn("Cache EVICT failed ({}): {}", cache.getName(), ex.getMessage());
            }
            @Override
            public void handleCacheClearError(@NonNull RuntimeException ex, @NonNull org.springframework.cache.Cache cache) {
                log.warn("Cache CLEAR failed ({}): {}", cache.getName(), ex.getMessage());
            }
        };
    }
}
