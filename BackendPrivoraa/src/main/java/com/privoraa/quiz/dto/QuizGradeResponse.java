package com.privoraa.quiz.dto;

import java.util.List;

public record QuizGradeResponse(
        int score,
        int total,
        List<Feedback> feedback
) {
    public record Feedback(
            int index,
            boolean correct,
            int correctIndex,
            Integer yourIndex,
            String explanation
    ) {}
}
