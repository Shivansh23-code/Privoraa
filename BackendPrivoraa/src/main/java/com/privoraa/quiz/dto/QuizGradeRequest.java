package com.privoraa.quiz.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record QuizGradeRequest(
        @NotNull List<QuizQuestion> questions,
        @NotNull List<Integer> answers
) {}
