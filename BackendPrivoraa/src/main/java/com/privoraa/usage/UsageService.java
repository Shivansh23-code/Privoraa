package com.privoraa.usage;

import com.privoraa.conversation.Message;
import com.privoraa.conversation.MessageRepository;
import com.privoraa.usage.dto.UsageResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class UsageService {

    private final MessageRepository messageRepository;

    public UsageService(MessageRepository messageRepository) {
        this.messageRepository = messageRepository;
    }

    @Transactional(readOnly = true)
    public UsageResponse getUsage(String userId) {
        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        List<Message> recent = messageRepository.findAssistantMessagesSince(userId, weekAgo);

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long todayReq = 0, todayPrompt = 0, todayCompletion = 0;

        // Seed the last 7 calendar days so the chart always has a full window.
        Map<String, long[]> perDay = new LinkedHashMap<>(); // date -> [requests, tokens]
        for (int i = 6; i >= 0; i--) {
            perDay.put(today.minusDays(i).toString(), new long[]{0, 0});
        }
        Map<String, long[]> perModel = new LinkedHashMap<>(); // model -> [tokens, requests]

        for (Message m : recent) {
            int tokens = m.getPromptTokens() + m.getCompletionTokens();
            LocalDate date = m.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
            perDay.computeIfAbsent(date.toString(), k -> new long[]{0, 0});
            long[] day = perDay.get(date.toString());
            day[0]++;
            day[1] += tokens;

            String model = m.getModelUsed() == null ? "Unknown" : m.getModelUsed();
            long[] mu = perModel.computeIfAbsent(model, k -> new long[]{0, 0});
            mu[0] += tokens;
            mu[1]++;

            if (date.equals(today)) {
                todayReq++;
                todayPrompt += m.getPromptTokens();
                todayCompletion += m.getCompletionTokens();
            }
        }

        List<UsageResponse.DailyUsage> last7 = perDay.entrySet().stream()
                .map(e -> new UsageResponse.DailyUsage(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList();

        List<UsageResponse.ModelUsage> byModel = new ArrayList<>(perModel.entrySet().stream()
                .map(e -> new UsageResponse.ModelUsage(e.getKey(), e.getValue()[0], e.getValue()[1]))
                .toList());
        byModel.sort(Comparator.comparingLong(UsageResponse.ModelUsage::tokens).reversed());

        return new UsageResponse(
                new UsageResponse.Today(todayReq, todayPrompt, todayCompletion),
                last7,
                byModel,
                messageRepository.totalTokensForUser(userId),
                messageRepository.totalRequestsForUser(userId),
                0L // free models
        );
    }
}
