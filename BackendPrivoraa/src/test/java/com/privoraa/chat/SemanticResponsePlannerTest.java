package com.privoraa.chat;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SemanticResponsePlannerTest {
    private final SemanticResponsePlanner planner = new SemanticResponsePlanner();
    private static final String LARGE = "Create a complete Spring Boot CRUD API including Entity, DTO, "
            + "Repository, Service, Controller, Exception Handling, Validation, Security Configuration, JWT, "
            + "and Maven dependencies.";

    @Test
    void shortPromptUsesNormalGeneration() {
        assertNull(planner.plan("Explain dependency injection briefly.", 4096));
        assertNull(planner.plan(null, 4096));
        assertNull(planner.plan("   ", 4096));
        assertNull(planner.plan("We met for lunch, discussed work, and walked home together.", 4096));
    }

    @Test
    void largeStructuredPromptCreatesSemanticPlanNearThreeQuarters() {
        SemanticResponsePlanner.Plan plan = planner.plan(LARGE, 4096);
        assertNotNull(plan);
        assertEquals(10, plan.sections().size());
        assertFalse(plan.currentSections().isEmpty());
        assertFalse(plan.remainingSections().isEmpty());
        double ratio = (double) plan.currentSections().size() / plan.sections().size();
        assertTrue(ratio >= .6 && ratio <= .9, "semantic boundary should be near 70–80%, not exact");
    }

    @Test
    void segmentsContainWholeRequestedSections() {
        SemanticResponsePlanner.Plan plan = planner.plan(LARGE, 4096);
        assertEquals(plan.sections(), java.util.stream.Stream.concat(
                plan.currentSections().stream(), plan.remainingSections().stream()).toList());
        assertTrue(plan.currentSections().stream().noneMatch(String::isBlank));
    }

    @Test
    void instructionsForbidPartialCodeAndRepetition() {
        SemanticResponsePlanner.Plan first = planner.plan(LARGE, 4096);
        String initial = planner.generationInstruction(first);
        assertTrue(initial.contains("Never stop inside a class, method, fenced code block, XML, JSON"));
        String continuation = planner.continuationInstruction(first.advance());
        assertTrue(continuation.contains("Do not repeat completed content"));
        assertTrue(continuation.contains("finish every class, method, code block"));
    }

    @Test
    void persistedPlanRoundTripsAndFinalSegmentHasNoRemainingContent() {
        SemanticResponsePlanner.Plan first = planner.plan(LARGE, 4096);
        SemanticResponsePlanner.Plan restored = planner.read(planner.write(first));
        assertEquals(first, restored);
        SemanticResponsePlanner.Plan last = restored.advance();
        assertFalse(last.hasRemainingContent());
        assertEquals(List.of(), last.remainingSections());
        assertEquals(2, last.segmentIndex());
    }

    @Test
    void longPromptWithThreeMajorDeliverablesCanStillBePlanned() {
        String detail = " with complete implementation details, production constraints, examples, edge cases, "
                + "configuration guidance, validation rules, error behavior, and comprehensive code samples".repeat(5);
        String prompt = "Build the following:\n1. Authentication service" + detail
                + "\n2. Payment service" + detail + "\n3. Reporting service" + detail;
        assertNotNull(planner.plan(prompt, 2048));
    }

    @Test
    void sixTinyItemsDoNotTriggerSegmentation() {
        assertNull(planner.plan("Include A, B, C, D, E, and F.", 2048));
    }

    @Test
    void numberedAndBulletListsAreParsedAndDuplicatesKeepFirstSpelling() {
        String prompt = "Build these modules:\n1. Complete Entity implementation and schema\n"
                + "2. complete entity implementation and schema\n- Complete Repository implementation and tests\n"
                + "* Complete Service implementation and validation\n4) Complete Controller implementation and API";
        SemanticResponsePlanner.Plan plan = planner.plan(prompt, 2048);
        assertNotNull(plan);
        assertEquals(4, plan.sections().size());
        assertEquals("Complete Entity implementation and schema", plan.sections().getFirst());
    }
}
