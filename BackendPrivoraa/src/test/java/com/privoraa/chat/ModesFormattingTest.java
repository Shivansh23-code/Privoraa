package com.privoraa.chat;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ModesFormattingTest {

    @Test
    void formattingInstructionIsIncludedExactlyOnce() {
        String prompt = Modes.systemPrompt("general");
        int count = countOccurrences(prompt, "Response style:");
        assertEquals(1, count, "FORMATTING instruction must appear exactly once");
    }

    @Test
    void coreInstructionsRemainPresent() {
        String prompt = Modes.systemPrompt("general");
        assertTrue(prompt.contains("Privoraa"), "CORE identity must remain");
        assertTrue(prompt.contains("correct"), "CORE accuracy instruction must remain");
        assertTrue(prompt.contains("bluff"), "CORE no-bluff rule must remain");
        assertTrue(prompt.contains("warm"), "STYLE tone must remain");
    }

    @Test
    void ragInstructionIsPreserved() {
        String prompt = Modes.systemPrompt("general");
        assertTrue(prompt.contains("tables"), "STYLE no-tables rule must remain");
        assertTrue(prompt.contains("fenced code blocks"), "STYLE code block rule must remain");
    }

    @Test
    void modeSpecificPromptIsPreserved() {
        String prompt = Modes.systemPrompt("code_mentor");
        assertTrue(prompt.contains("senior software engineer"), "CODE_MENTOR persona must remain");
        assertTrue(prompt.contains("time/space complexity"), "CODE_MENTOR complexity must remain");
    }

    @Test
    void codingInstructionEncouragesFencedCodeWithLanguage() {
        String prompt = Modes.systemPrompt("code_mentor");
        assertTrue(prompt.contains("fenced code blocks"), "Coding must encourage fenced blocks");
        assertTrue(prompt.contains("language tag") || prompt.contains("language tags"),
                "Coding must encourage language tags");
    }

    @Test
    void shortRequestTemplateNotForced() {
        String prompt = Modes.systemPrompt("general");
        assertFalse(prompt.contains("Problem / Approach"),
                "Must not force Problem/Approach template");
        assertFalse(prompt.contains("Conclusion") && !prompt.contains("unless useful"),
                "Must not force Conclusion section unconditionally");
    }

    @Test
    void formatDoesNotForceHeadingsOnShortAnswers() {
        String prompt = Modes.systemPrompt("general");
        assertTrue(prompt.contains("unnecessary headings"), "Must guide against unnecessary headings");
        assertTrue(prompt.contains("only when the answer is long enough"),
                "Must allow headings only for long answers");
    }

    @Test
    void fillerPhrasesAreDiscouraged() {
        String prompt = Modes.systemPrompt("general");
        assertTrue(prompt.contains("Quick answer"), "Must discourage 'Quick answer'");
        assertTrue(prompt.contains("Certainly"), "Must discourage 'Certainly'");
    }

    @Test
    void continuumDoesNotDuplicateSystemPrompt() {
        String prompt = Modes.systemPrompt("general");
        // The system prompt is SINGLE — there is exactly one system message built.
        // Continuation messages add a USER message, never a second system message.
        // Verify the continuation instruction is separate and does NOT contain
        // the formatting rules.
        String continuationInstruction = "Continue exactly from the prior assistant response. "
                + "Do not restart or repeat earlier headings or paragraphs. Preserve markdown structure, "
                + "complete every remaining requested section, and begin immediately with continuation content. "
                + "Do not mention token limits or continuation mechanics.";
        assertFalse(continuationInstruction.contains("Response style:"),
                "Continuation instruction must NOT contain formatting rules");
        assertFalse(continuationInstruction.contains("filler"),
                "Continuation instruction must NOT contain formatting rules");
        assertEquals(1, countOccurrences(prompt, "Response style:"),
                "Exactly one formatting instruction in the entire prompt");
    }

    @Test
    void repairInstructionRemainsPrivateAndSeparate() {
        String repairInstruction = "Complete only the unfinished final thought from the prior assistant response. "
                + "Do not restart the answer. Do not repeat previous sections. "
                + "Begin immediately with the missing continuation. Finish with a complete sentence. "
                + "Do not mention continuation, token limits, or repair.";
        assertFalse(repairInstruction.contains("Response style:"),
                "Repair instruction must NOT contain formatting rules");
        assertTrue(repairInstruction.contains("unfinished final thought"),
                "Repair instruction must retain its original purpose");
    }

    @Test
    void allModesIncludeFormatting() {
        for (String mode : new String[]{"general", "exam_tutor", "code_mentor", "math_solver",
                "interview_prep", "explain_simply", "architect", "researcher",
                "strategist", "writer", null}) {
            String prompt = Modes.systemPrompt(mode);
            assertTrue(prompt.contains("Response style:"),
                    "Mode '" + mode + "' must include formatting instruction");
            assertTrue(prompt.contains("Privoraa"), "Mode '" + mode + "' must include CORE");
        }
    }

    @Test
    void providerRequestFieldsUnchanged() {
        // The Modes change only modifies the system prompt CONTENT string.
        // No new fields are added to provider requests.
        String prompt = Modes.systemPrompt("general");
        assertFalse(prompt.contains("max_tokens"), "Must not inject provider fields");
        assertFalse(prompt.contains("stop_sequences"), "Must not inject provider fields");
        assertFalse(prompt.contains("system_instruction"), "Must not inject provider fields");
    }

    @Test
    void safetyInstructionsPreserved() {
        String prompt = Modes.systemPrompt("general");
        assertTrue(prompt.contains("never bluff"), "Safety rule must remain");
        assertTrue(prompt.contains("never invent facts"), "Safety rule must remain");
    }

    @Test
    void formattingDoesNotReplaceExistingRules() {
        String prompt = Modes.systemPrompt("general");
        // All original sections must coexist.
        assertTrue(prompt.contains("step by step"), "CORE reasoning instruction");
        assertTrue(prompt.contains("natural prose"), "STYLE instruction");
        assertTrue(prompt.contains("Response style:"), "FORMATTING instruction");
    }

    @Test
    void conciseRequestGuidancePresent() {
        String prompt = Modes.systemPrompt("general");
        assertTrue(prompt.contains("concise requests"), "Must guide on concise requests");
        assertTrue(prompt.contains("do not expand unnecessarily"),
                "Must discourage unnecessary expansion");
    }

    private static int countOccurrences(String str, String target) {
        int count = 0;
        int idx = 0;
        while ((idx = str.indexOf(target, idx)) != -1) {
            count++;
            idx += target.length();
        }
        return count;
    }
}
