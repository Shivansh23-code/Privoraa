package com.privoraa.usage.dto;

import java.util.List;

public record UsageResponse(
        Today today,
        List<DailyUsage> last7Days,
        List<ModelUsage> byModel,
        long totalTokens,
        long totalRequests,
        long estCostMicros
) {
    public record Today(long requests, long promptTokens, long completionTokens) {}

    public record DailyUsage(String date, long requests, long tokens) {}

    public record ModelUsage(String model, long tokens, long requests) {}
}
