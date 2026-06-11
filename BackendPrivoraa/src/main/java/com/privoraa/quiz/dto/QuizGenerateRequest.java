package com.privoraa.quiz.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record QuizGenerateRequest(
        @NotBlank @Size(max = 200) String topic,
        @Min(1) @Max(10) Integer count,
        String difficulty
) {
    public int countOrDefault() {
        return count == null ? 5 : count;
    }

    public String difficultyOrDefault() {
        return difficulty == null || difficulty.isBlank() ? "medium" : difficulty;
    }
}
