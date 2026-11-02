package com.smartpark.common;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Small fixed-window rate limiter for sensitive authentication endpoints.
 * Single-instance scope; production deployments with multiple API instances should
 * replace it with a shared Redis-backed limiter. Account lockout is persisted in PostgreSQL.
 */
@Service
public class RateLimitService {

    private record Window(long startEpochSecond, int count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public void check(String key, int limitPerMinute) {
        long now = Instant.now().getEpochSecond();
        windows.compute(key, (k, existing) -> {
            if (existing == null || now - existing.startEpochSecond() >= 60) {
                return new Window(now, 1);
            }
            if (existing.count() >= limitPerMinute) {
                throw new RateLimitException("Too many attempts. Please wait a minute and try again.");
            }
            return new Window(existing.startEpochSecond(), existing.count() + 1);
        });
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> now - e.getValue().startEpochSecond() > 300);
        }
    }
}
