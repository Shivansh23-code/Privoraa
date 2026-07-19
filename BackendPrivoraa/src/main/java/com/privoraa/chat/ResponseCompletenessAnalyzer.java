package com.privoraa.chat;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Markdown-aware structural response finalization analyzer.
 *
 * Detects structurally incomplete responses using block-level and
 * character-level analysis, without relying on hardcoded dangling phrases.
 * Small lexical continuation hints exist only as secondary evidence.
 */
public final class ResponseCompletenessAnalyzer {

    public enum State {
        COMPLETE,
        INCOMPLETE_PROSE_BLOCK,
        OPEN_CODE_FENCE,
        UNMATCHED_DELIMITER,
        UNFINISHED_MARKDOWN,
        NO_SAFE_FALLBACK
    }

    private static final Set<String> ABBREVIATIONS = Set.of(
            "e.g.", "i.e.", "etc.", "mr.", "mrs.", "ms.", "dr.", "prof.",
            "sr.", "jr.", "vs.", "fig.", "no.", "st.", "approx.", "dept.",
            "est.", "inc.", "ltd.", "co.");

    /** Secondary lexical hints — not the primary mechanism. */
    private static final Set<String> CONTINUATION_HINTS = Set.of(
            "however", "but", "and", "or", "because", "although", "while",
            "whereas", "therefore", "moreover", "furthermore", "nevertheless",
            "nonetheless", "consequently", "then");

    private static final Set<Character> SENTENCE_END = Set.of('.', '!', '?', '\u0964', '\uFE52', '\u3002');

    private ResponseCompletenessAnalyzer() {}

    public static Result analyze(String content) {
        if (content == null || content.isBlank()) {
            return new Result(State.NO_SAFE_FALLBACK, "blank response",
                    -1, -1, "", false, false);
        }

        String text = content.stripTrailing();

        CharScan cs = charScan(text);
        BlockAnalysis ba = blockAnalysis(text);

        if (cs.openFence) {
            return result(State.OPEN_CODE_FENCE, "open fenced code block",
                    cs, ba, text);
        }
        if (cs.unbalancedParen || cs.unbalancedSquare || cs.unbalancedBrace) {
            return result(State.UNMATCHED_DELIMITER, "unmatched delimiter",
                    cs, ba, text);
        }
        if (cs.unfinishedMarkdown) {
            return result(State.UNFINISHED_MARKDOWN, "unfinished markdown span",
                    cs, ba, text);
        }

        if (ba.lastBlock != null
                && !isStructurallyComplete(ba.lastBlock, cs, text)) {
            int sentenceEnd = cs.lastSafeBoundary;
            if (sentenceEnd >= 0) {
                String suffix = text.substring(sentenceEnd).strip();
                if (!suffix.isEmpty()) {
                    return new Result(State.INCOMPLETE_PROSE_BLOCK,
                            "incomplete final prose block",
                            sentenceEnd, ba.lastCompleteBlockEnd,
                            suffix, true, true);
                }
            }
            if (ba.lastCompleteBlockEnd >= 0) {
                return new Result(State.INCOMPLETE_PROSE_BLOCK,
                        "incomplete final block, prior block boundary used",
                        -1, ba.lastCompleteBlockEnd,
                        text.substring(ba.lastCompleteBlockEnd).strip(),
                        true, true);
            }
            return new Result(State.NO_SAFE_FALLBACK,
                    "incomplete ending without safe prior boundary",
                    -1, -1, text, false, false);
        }

        return new Result(State.COMPLETE, "structurally complete",
                text.length(), text.length(), "", false, false);
    }

    private static Result result(State state, String reason,
                                  CharScan cs, BlockAnalysis ba, String text) {
        int sentenceEnd = cs.lastSafeBoundary;
        int blockEnd = ba.lastCompleteBlockEnd;
        String suffix;
        boolean repair;
        boolean trim;

        if (sentenceEnd >= 0) {
            suffix = text.substring(sentenceEnd).strip();
            repair = true;
            trim = true;
        } else if (blockEnd >= 0) {
            suffix = text.substring(blockEnd).strip();
            repair = true;
            trim = true;
        } else {
            suffix = text;
            repair = false;
            trim = false;
        }
        return new Result(state, reason, sentenceEnd, blockEnd, suffix, repair, trim);
    }

    // --------------------------------------------------------------- scanning

    private static CharScan charScan(String text) {
        boolean inFence = false;
        boolean inInlineCode = false;
        int paren = 0, square = 0, brace = 0;
        int lastSafeBoundary = -1;

        for (int i = 0; i < text.length(); i++) {
            if (startsFence(text, i)) {
                inFence = !inFence;
                i += 2;
                continue;
            }
            char ch = text.charAt(i);
            if (!inFence && ch == '`') {
                inInlineCode = !inInlineCode;
                continue;
            }
            if (inFence || inInlineCode) continue;

            switch (ch) {
                case '(' -> paren++;
                case ')' -> paren = Math.max(0, paren - 1);
                case '[' -> square++;
                case ']' -> square = Math.max(0, square - 1);
                case '{' -> brace++;
                case '}' -> brace = Math.max(0, brace - 1);
            }

            if (isSentenceEnd(ch) && isSafeBoundary(text, i)) {
                lastSafeBoundary = i + 1;
            }
        }

        boolean unfinished = unfinishedMarkdown(text, inFence, inInlineCode);
        return new CharScan(inFence, paren > 0, square > 0, brace > 0,
                lastSafeBoundary, unfinished);
    }

    private static boolean isSentenceEnd(char ch) {
        return SENTENCE_END.contains(ch);
    }

    private static boolean unfinishedMarkdown(String text, boolean inFence, boolean inInlineCode) {
        long ticks = text.chars().filter(ch -> ch == '`').count();
        if (ticks % 2 != 0) return true;
        if (!inFence && !inInlineCode) {
            int openBracket = text.lastIndexOf('[');
            int closeBracket = text.lastIndexOf(']');
            if (openBracket > closeBracket) return true;
            int linkStart = text.lastIndexOf("](");
            if (linkStart >= 0 && text.indexOf(')', linkStart + 2) < 0) return true;
        }
        return false;
    }

    // --------------------------------------------------------- block analysis

    static final class Block {
        final BlockType type;
        final String content;
        final int start;
        final int end;
        Block(BlockType type, String content, int start, int end) {
            this.type = type; this.content = content; this.start = start; this.end = end;
        }
    }

    enum BlockType {
        HEADING, PARAGRAPH, LIST_ITEM, CODE_BLOCK, BLOCKQUOTE, TABLE, OTHER
    }

    private static BlockAnalysis blockAnalysis(String text) {
        String[] raw = text.split("\\n\\n+", -1);
        List<String> nonEmpty = new ArrayList<>();
        for (String r : raw) {
            String s = r.strip();
            if (!s.isEmpty()) nonEmpty.add(s);
        }
        if (nonEmpty.isEmpty()) {
            return new BlockAnalysis(-1, -1, null);
        }

        int pos = 0;
        int lastCompleteBlockEnd = -1;
        Block lastBlock = null;

        for (int i = 0; i < nonEmpty.size(); i++) {
            String blockStr = nonEmpty.get(i);
            int idx = text.indexOf(blockStr, pos);
            if (idx < 0) continue;
            int end = idx + blockStr.length();
            pos = end;

            BlockType type = classifyBlockType(blockStr);
            lastBlock = new Block(type, blockStr, idx, end);

            if (i < nonEmpty.size() - 1) {
                if (isCompleteBlock(blockStr, type)) {
                    lastCompleteBlockEnd = end;
                }
            }
        }

        return new BlockAnalysis(lastCompleteBlockEnd,
                lastCompleteBlockEnd, lastBlock);
    }

    static BlockType classifyBlockType(String block) {
        String trimmed = block.strip();
        if (trimmed.startsWith("#") && trimmed.length() > 1
                && (trimmed.charAt(1) == ' ' || trimmed.charAt(1) == '#')) {
            return BlockType.HEADING;
        }
        if (trimmed.startsWith(">")) return BlockType.BLOCKQUOTE;
        if (trimmed.matches("(?s)^```[\\s\\S]*```$")) return BlockType.CODE_BLOCK;
        if (trimmed.matches("(?m)^[-*+]\\s.+") || trimmed.matches("(?m)^\\d+[.)]\\s.+")) {
            return BlockType.LIST_ITEM;
        }
        if (trimmed.contains("\n---") || trimmed.contains("\n|---")) {
            return BlockType.TABLE;
        }
        return BlockType.PARAGRAPH;
    }

    static boolean isCompleteBlock(String block, BlockType type) {
        return switch (type) {
            case HEADING -> {
                String[] lines = block.split("\n", 2);
                if (lines.length <= 1) yield true;
                yield hasTerminalPunctuation(lines[1]) || isShortAnswer(lines[1]);
            }
            case LIST_ITEM -> true;
            case BLOCKQUOTE -> isCompleteBlock(block.replaceAll("^>\\s?", ""), BlockType.PARAGRAPH);
            case CODE_BLOCK -> block.strip().endsWith("```");
            case TABLE -> block.matches("(?s).*\\|.*\\|---.*\\|.*");
            case PARAGRAPH, OTHER -> isCompleteParagraph(block);
        };
    }

    private static boolean isShortAnswer(String s) {
        String v = s.strip();
        if (v.isEmpty()) return false;
        if (v.length() > 15) return false;
        return v.matches("(?i)^(yes|no|true|false|none|ok|okay|\\d+(\\.\\d+)?)$");
    }

    private static boolean isStructurallyComplete(Block block, CharScan cs, String fullText) {
        if (isCompleteBlock(block.content, block.type)) return true;
        if (hasTerminalPunctuation(block.content)) return true;
        if (endsWithCommaColonSemicolon(block.content)) return false;

        int startPos = block.start;
        int endPos = block.end;

        // Check suffix after last sentence boundary
        if (cs.lastSafeBoundary >= startPos && cs.lastSafeBoundary < endPos) {
            String suffix = fullText.substring(cs.lastSafeBoundary, endPos).strip();
            if (isValidStandalone(suffix)) return true;
            if (hasTerminalPunctuation(suffix)) return true;
            if (suffix.endsWith(",") || suffix.endsWith(":") || suffix.endsWith(";")) return false;
            if (hasContinuationHint(suffix)) return false;
            if (endsWithContinuationHint(suffix)) return false;
            int len = suffix.length();
            if (len < 20) return false;
            if (len > 50) return false;
            return true;
        }
        if (cs.lastSafeBoundary >= endPos) return true;

        return isValidStandaloneBlock(block.content);
    }

    /** Secondary lexical hint: suffix ends with a continuation word. */
    private static boolean endsWithContinuationHint(String suffix) {
        if (suffix.isBlank()) return false;
        String lastWord = suffix.replaceAll(".*\\s+", "").replaceAll("[^\\p{L}]", "");
        return CONTINUATION_HINTS.contains(lastWord.toLowerCase(Locale.ROOT));
    }

    /** Secondary lexical hint check — not the primary mechanism. */
    private static boolean hasContinuationHint(String suffix) {
        if (suffix.isBlank()) return false;
        suffix = suffix.toLowerCase(Locale.ROOT);
        String firstWord = suffix.split("\\s+", 2)[0]
                .replaceAll("[^\\p{L}]", "");
        return CONTINUATION_HINTS.contains(firstWord);
    }

    private static boolean isCompleteParagraph(String block) {
        String trimmed = block.strip();
        if (trimmed.isEmpty()) return true;
        if (hasTerminalPunctuation(trimmed) && endsWithSafeChar(trimmed)) return true;
        if (isValidStandaloneBlock(trimmed)) return true;
        return false;
    }

    private static boolean hasTerminalPunctuation(String s) {
        String trimmed = s.strip();
        if (trimmed.isEmpty()) return false;
        char last = trimmed.charAt(trimmed.length() - 1);
        return SENTENCE_END.contains(last);
    }

    private static boolean endsWithCommaColonSemicolon(String s) {
        String trimmed = s.strip();
        return trimmed.endsWith(",") || trimmed.endsWith(":") || trimmed.endsWith(";");
    }

    private static boolean endsWithSafeChar(String s) {
        String trimmed = s.stripTrailing();
        if (trimmed.isEmpty()) return false;
        int idx = trimmed.length() - 1;
        return isSafeBoundary(trimmed, idx);
    }

    /**
     * Strict standalone check for suffix context (after a sentence boundary).
     * Only accepts unambiguous standalone forms — not generic alphabetic words.
     */
    private static boolean isValidStandalone(String s) {
        String v = s.strip();
        if (v.length() > 100) return false;
        if (!v.contains("\n") && (v.startsWith("#") || v.startsWith("-") || v.startsWith("*") || v.startsWith("+"))) return true;
        if (v.matches("(?i)^(https?://|www\\.)\\S+$")) return true;
        if (v.matches("(?i).*\\b(version|v)\\s*\\d+\\.\\d+$")) return true;
        if (v.matches(".*\\b\\d+\\.\\d+\\s*$")) return true;
        if (v.matches("[A-Za-z_$][\\w$]*(?:\\.[\\w$]+)*\\([^)]*\\)?")) return true;
        if (v.matches("GET\\s+/\\S+") || v.matches("POST\\s+/\\S+")
                || v.matches("PUT\\s+/\\S+") || v.matches("DELETE\\s+/\\S+")) return true;
        if (v.matches("O\\s*\\(\\s*1\\s*\\)") || v.matches("O\\s*\\(\\s*n\\s*\\)")
                || v.matches("O\\s*\\(\\s*log\\s*n\\s*\\)")) return true;
        if (v.matches("\\d+(\\.\\d+)?")) return true;
        if (v.matches("`[^`]+`")) return true;
        if (v.matches("\\[[^\\]]+\\]\\([^)]+\\)")) return true;
        if (v.matches("\\[[^\\]]+\\]\\([^)]+")) return true;
        return ABBREVIATIONS.stream().anyMatch(v::endsWith);
    }

    /**
     * Permissive standalone check for entire-block context.
     * Accepts generic single alphabetic words as intentional short answers.
     */
    private static boolean isValidStandaloneBlock(String s) {
        if (isValidStandalone(s)) return true;
        String v = s.strip();
        return v.matches("\\p{L}{1,30}") && v.length() >= 1;
    }

    static boolean isSafeBoundary(String text, int index) {
        char punct = text.charAt(index);
        if (index + 1 < text.length() && !Character.isWhitespace(text.charAt(index + 1))
                && punct != '\u0964' && punct != '\u3002') {
            return false;
        }
        if (punct != '.' && punct != '\u0964') return true;
        if (punct == '\u0964') return true;
        if (index > 0 && index + 1 < text.length()
                && Character.isDigit(text.charAt(index - 1))
                && Character.isDigit(text.charAt(index + 1))) {
            return false;
        }
        int start = index;
        while (start > 0 && !Character.isWhitespace(text.charAt(start - 1))) start--;
        String token = text.substring(start, index + 1).toLowerCase(Locale.ROOT);
        return !ABBREVIATIONS.contains(token)
                && !token.matches("(?:[a-z]\\.){2,}")
                && !token.contains("://")
                && !token.startsWith("www.");
    }

    private static boolean startsFence(String text, int index) {
        return index + 2 < text.length() && text.startsWith("```", index);
    }

    // --------------------------------------------------------------- records

    public record Result(State state, String reason,
                         int lastCompleteSentenceBoundary,
                         int lastCompleteBlockBoundary,
                         String suspiciousSuffix,
                         boolean repairRecommended,
                         boolean trimSafe) {}

    private record CharScan(boolean openFence, boolean unbalancedParen,
                            boolean unbalancedSquare, boolean unbalancedBrace,
                            int lastSafeBoundary, boolean unfinishedMarkdown) {}

    private record BlockAnalysis(int lastCompleteBlockEnd,
                                 int lastCompleteBoundary,
                                 Block lastBlock) {}
}
