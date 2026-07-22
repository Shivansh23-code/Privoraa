package com.privoraa.chat;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/** Provider-independent, deterministic planning for large structured answers. */
@Component
public final class SemanticResponsePlanner {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int MIN_SECTIONS = 3;
    private static final Pattern LIST_ITEM = Pattern.compile("(?m)^\\s*(?:[-*•]|\\d+[.)])\\s+(.+?)\\s*$");

    public Plan plan(String prompt, int safeOutputTokens) {
        List<String> sections = extractSections(prompt);
        if (sections.size() < MIN_SECTIONS || safeOutputTokens <= 0) return null;
        List<Integer> weights = sections.stream().map(this::estimatedTokens).toList();
        int total = weights.stream().mapToInt(Integer::intValue).sum();
        if (total < Math.max(2200, (int) (safeOutputTokens * .9))) return null;

        int target = (int) (total * .75);
        int running = 0;
        int boundary = 0;
        while (boundary < sections.size() - 1 && running + weights.get(boundary) <= target) {
            running += weights.get(boundary++);
        }
        if (boundary == 0) boundary = 1;
        return new Plan(sections, boundary, 1, 2);
    }

    public String write(Plan plan) {
        if (plan == null) return null;
        try { return JSON.writeValueAsString(plan); }
        catch (Exception e) { throw new IllegalStateException("Could not serialize response plan", e); }
    }

    public Plan read(String value) {
        if (value == null || value.isBlank()) return null;
        try { return JSON.readValue(value, Plan.class); }
        catch (Exception ignored) { return null; } // backward-compatible with legacy/corrupt metadata
    }

    public String generationInstruction(Plan plan) {
        if (plan == null) return null;
        return "Planned response structure (follow it exactly):\nAll sections: "
                + String.join("; ", plan.sections()) + "\nGenerate in this response only: "
                + String.join("; ", plan.currentSections()) + "\nReserve for the next response: "
                + String.join("; ", plan.remainingSections()) + "\nFinish every assigned section completely. "
                + "Never stop inside a class, method, fenced code block, XML, JSON, list, or Markdown structure. "
                + "Do not generate, preview, or summarize reserved sections.";
    }

    public String continuationInstruction(Plan plan) {
        return "Continue the original answer using its persisted response plan. Completed sections: "
                + String.join("; ", plan.completedSections()) + ". Generate only these remaining sections: "
                + String.join("; ", plan.currentSections()) + ". Do not repeat completed content. "
                + "Begin immediately with the first remaining section and finish every class, method, code block, "
                + "XML, JSON, list, and Markdown structure completely. Do not mention continuation mechanics.";
    }

    private List<String> extractSections(String prompt) {
        if (prompt == null) return List.of();
        if (prompt == null || prompt.isBlank()) return List.of();
        String candidate = prompt.replace('\r', '\n');
        int marker = lastMarker(candidate.toLowerCase(Locale.ROOT));
        List<String> raw = new ArrayList<>();
        if (marker >= 0) {
            raw.addAll(Arrays.asList(candidate.substring(marker)
                    .split("(?i)\\s*(?:,|;|\\n|\\band\\b|\\bplus\\b)\\s*")));
        } else {
            Matcher items = LIST_ITEM.matcher(candidate);
            while (items.find()) raw.add(items.group(1));
        }
        LinkedHashMap<String, String> clean = new LinkedHashMap<>();
        raw.stream().map(this::cleanSection)
                .filter(s -> s.length() >= 2 && s.length() <= 2000)
                .forEach(s -> clean.putIfAbsent(s.toLowerCase(Locale.ROOT), s));
        return new ArrayList<>(clean.values());
    }

    private int lastMarker(String prompt) {
        int best = -1;
        for (String marker : List.of(" including ", " include ", " with the following", " consisting of ")) {
            int at = prompt.lastIndexOf(marker);
            if (at >= 0) best = Math.max(best, at + marker.length());
        }
        return best;
    }

    private String cleanSection(String raw) {
        return raw.replaceAll("^[\\s:.-]+|[\\s:?.]+$", "")
                .replaceAll("\\s+", " ").trim();
    }

    private int estimatedTokens(String section) {
        String lower = section.toLowerCase(Locale.ROOT);
        int weight = Math.max(120, section.length() / 2);
        if (lower.matches(".*(entity|dto|repository|service|controller|configuration|security|jwt|exception|validation|dependencies|pom|gradle|test).*")) weight += 420;
        if (lower.matches(".*(complete|implementation|code|api|schema).*")) weight += 160;
        return weight;
    }

    public record Plan(List<String> sections, int firstSegmentEnd, int segmentIndex, int totalSegments) {
        public Plan {
            sections = sections == null ? List.of() : List.copyOf(sections);
        }
        public List<String> currentSections() {
            return segmentIndex <= 1 ? sections.subList(0, firstSegmentEnd) : sections.subList(firstSegmentEnd, sections.size());
        }
        public List<String> completedSections() {
            return segmentIndex <= 1 ? List.of() : sections.subList(0, firstSegmentEnd);
        }
        public List<String> remainingSections() {
            return segmentIndex <= 1 ? sections.subList(firstSegmentEnd, sections.size()) : List.of();
        }
        public boolean hasRemainingContent() { return !remainingSections().isEmpty(); }
        public Plan advance() { return new Plan(sections, firstSegmentEnd, Math.min(2, segmentIndex + 1), totalSegments); }
    }
}
