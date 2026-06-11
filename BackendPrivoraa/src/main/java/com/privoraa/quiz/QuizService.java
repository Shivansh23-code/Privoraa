package com.privoraa.quiz;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.common.ApiException;
import com.privoraa.llm.ChatResult;
import com.privoraa.llm.OpenRouterClient;
import com.privoraa.quiz.dto.QuizGenerateRequest;
import com.privoraa.quiz.dto.QuizGradeRequest;
import com.privoraa.quiz.dto.QuizGradeResponse;
import com.privoraa.quiz.dto.QuizQuestion;
import com.privoraa.ratelimit.RateLimitService;
import com.privoraa.routing.RouterDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class QuizService {

    private final OpenRouterClient openRouter;
    private final RateLimitService rateLimit;
    private final ObjectMapper mapper;

    private static final List<String> CHAIN = List.of(
            RouterDefaults.forCategory("reasoning"),
            RouterDefaults.forCategory("general"));

    public QuizService(OpenRouterClient openRouter, RateLimitService rateLimit, ObjectMapper mapper) {
        this.openRouter = openRouter;
        this.rateLimit = rateLimit;
        this.mapper = mapper;
    }

    public List<QuizQuestion> generate(String userId, QuizGenerateRequest req) {
        rateLimit.check(userId);

        int count = req.countOrDefault();
        String system = "You are a quiz generator. Respond with ONLY a JSON array — no prose, no code "
                + "fences. Each element must be an object with exactly: \"question\" (string), "
                + "\"options\" (array of exactly 4 strings), \"answerIndex\" (integer 0-3), "
                + "\"explanation\" (string).";
        String user = "Generate " + count + " " + req.difficultyOrDefault()
                + " multiple-choice questions about: " + req.topic();

        List<Map<String, Object>> messages = List.of(
                msg("system", system),
                msg("user", user));

        ChatResult result = complete(messages);
        return parse(result.content(), count);
    }

    public QuizGradeResponse grade(QuizGradeRequest req) {
        List<QuizQuestion> questions = req.questions();
        List<Integer> answers = req.answers();
        int score = 0;
        List<QuizGradeResponse.Feedback> feedback = new ArrayList<>();

        for (int i = 0; i < questions.size(); i++) {
            QuizQuestion q = questions.get(i);
            Integer your = i < answers.size() ? answers.get(i) : null;
            boolean correct = your != null && your == q.answerIndex();
            if (correct) {
                score++;
            }
            feedback.add(new QuizGradeResponse.Feedback(
                    i, correct, q.answerIndex(), your, q.explanation()));
        }
        return new QuizGradeResponse(score, questions.size(), feedback);
    }

    private ChatResult complete(List<Map<String, Object>> messages) {
        Exception last = null;
        for (String model : CHAIN) {
            try {
                return openRouter.completion(model, messages, 0.4, null);
            } catch (Exception e) {
                last = e;
            }
        }
        throw new ApiException(HttpStatus.BAD_GATEWAY,
                last == null ? "Quiz generation failed" : last.getMessage());
    }

    private List<QuizQuestion> parse(String content, int expected) {
        String json = extractJsonArray(content);
        try {
            QuizQuestion[] parsed = mapper.readValue(json, QuizQuestion[].class);
            List<QuizQuestion> valid = new ArrayList<>();
            for (QuizQuestion q : parsed) {
                if (q.question() == null || q.options() == null || q.options().size() < 2) {
                    continue;
                }
                int idx = Math.max(0, Math.min(q.answerIndex(), q.options().size() - 1));
                valid.add(new QuizQuestion(q.question(), q.options(), idx,
                        q.explanation() == null ? "" : q.explanation()));
                if (valid.size() >= expected) {
                    break;
                }
            }
            if (valid.isEmpty()) {
                throw new IllegalStateException("no valid questions");
            }
            return valid;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "The model did not return a valid quiz. Try again.");
        }
    }

    private String extractJsonArray(String content) {
        if (content == null) {
            return "[]";
        }
        int start = content.indexOf('[');
        int end = content.lastIndexOf(']');
        if (start >= 0 && end > start) {
            return content.substring(start, end + 1);
        }
        return content.trim();
    }

    private Map<String, Object> msg(String role, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }
}
