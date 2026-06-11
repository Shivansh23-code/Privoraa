package com.privoraa.quiz;

import com.privoraa.auth.PrivoraaUserDetails;
import com.privoraa.quiz.dto.QuizGenerateRequest;
import com.privoraa.quiz.dto.QuizGradeRequest;
import com.privoraa.quiz.dto.QuizGradeResponse;
import com.privoraa.quiz.dto.QuizQuestion;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/quiz")
@Tag(name = "Quiz", description = "Generate and grade multiple-choice quizzes")
public class QuizController {

    private final QuizService service;

    public QuizController(QuizService service) {
        this.service = service;
    }

    @PostMapping("/generate")
    @Operation(summary = "Generate MCQs on a topic")
    public List<QuizQuestion> generate(@AuthenticationPrincipal PrivoraaUserDetails user,
                                       @Valid @RequestBody QuizGenerateRequest request) {
        return service.generate(user.getId(), request);
    }

    @PostMapping("/grade")
    @Operation(summary = "Grade answers and explain mistakes")
    public QuizGradeResponse grade(@Valid @RequestBody QuizGradeRequest request) {
        return service.grade(request);
    }
}
