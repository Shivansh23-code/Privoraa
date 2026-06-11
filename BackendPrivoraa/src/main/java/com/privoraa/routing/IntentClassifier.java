package com.privoraa.routing;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Tier-1 heuristic intent detection (cheap, no extra model call). Mirrors the
 * frontend's preview classifier so "Auto" behaves consistently end to end.
 */
@Component
public class IntentClassifier {

    private static final Pattern CODE = Pattern.compile(
            "```|\\b(bug|stack ?trace|compile|function|class|regex|sql|exception|null ?pointer|"
                    + "segfault|refactor|typescript|java|python|c\\+\\+|async|api endpoint)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern MATH = Pattern.compile(
            "[\\u222B\\u2211\\u221A\\u2264\\u2265\\u2260\\u03C0\\u221E\\u2202]|\\\\frac|\\\\sqrt|\\\\int|\\$\\$|"
                    + "\\b(solve|prove|derivative|integral|probability|equation|theorem|step by step|"
                    + "matrix|differentiate|integrate)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern MULTILINGUAL = Pattern.compile(
            "\\p{IsCyrillic}|\\p{IsArabic}|\\p{IsDevanagari}|\\p{IsHan}|\\p{IsHiragana}|\\p{IsKatakana}");

    public Intent classify(String text, String mode, boolean useRag) {
        String t = text == null ? "" : text;

        // Mode can hard-bias the category.
        if ("code_mentor".equals(mode)) {
            return new Intent("code", "Code Mentor mode");
        }
        if ("math_solver".equals(mode)) {
            return new Intent("math", "Math Solver mode");
        }
        if ("exam_tutor".equals(mode)) {
            return new Intent("reasoning", "Exam Tutor mode");
        }

        if (useRag) {
            return new Intent("general", "Grounded on your notes");
        }
        if (CODE.matcher(t).find()) {
            return new Intent("code", "Looks like a coding question");
        }
        if (MATH.matcher(t).find()) {
            return new Intent("reasoning", "Looks like math / reasoning");
        }
        if (MULTILINGUAL.matcher(t).find()) {
            return new Intent("multilingual", "Non-Latin script detected");
        }
        if (t.length() < 80) {
            return new Intent("fast", "Short prompt — optimizing for speed");
        }
        return new Intent("general", "General conversation");
    }
}
