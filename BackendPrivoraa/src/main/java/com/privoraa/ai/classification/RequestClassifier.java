package com.privoraa.ai.classification;

import com.privoraa.routing.Intent;
import com.privoraa.routing.IntentClassifier;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Deterministic request analysis. It performs no network or model calls. */
@Component
public class RequestClassifier {

    private static final Pattern LOCAL_ONLY = Pattern.compile(
            "\\b(local only|offline only|private mode|use ollama only)\\b|"
                    + "do not send (this |anything )?to (the )?cloud|never leave my device",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SENSITIVE = Pattern.compile(
            "(?i)\\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|password|credential|"
                    + "private key|secret environment|bank account|credit card|medical record|"
                    + "social security|aadhaar|confidential source code)\\b|"
                    + "-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"
                    + "\\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{12,}");
    private static final Pattern PERSONAL = Pattern.compile(
            "(?i)\\b(my schedule|my preference|my account|my profile|my learning|remember that i|"
                    + "for me personally)\\b");
    private static final Pattern DEBUG = Pattern.compile(
            "(?i)(exception|stack ?trace|compiler error|runtime log|why (?:is|does).+fail|fix (?:this )?bug|"
                    + "\\bhttp [45]\\d\\d\\b|returns? [45]\\d\\d|sql error|nullpointerexception|"
                    + "caused by:|\\bat [a-zA-Z_$][\\w.$]+\\([^)]*:\\d+\\))");
    private static final Pattern REPOSITORY = Pattern.compile(
            "(?i)\\b(scan (?:this )?repository|trace (?:this )?api|find all usages|which files are affected|"
                    + "analy[sz]e (?:this |the )?project|frontend to backend flow|controller and repository)\\b");
    private static final Pattern ARCHITECTURE = Pattern.compile(
            "(?i)\\b(design (?:the )?architecture|system design|scalability|microservices?|"
                    + "database architecture|migration strategy)\\b");
    private static final Pattern CURRENT = Pattern.compile(
            "(?i)\\b(latest|current|today|recent|news|current price|current version|release schedule|"
                    + "in 20(?:2[6-9]|[3-9]\\d))\\b");
    private static final Pattern POSSIBLY_STALE = Pattern.compile(
            "(?i)\\b(version|release|price|law|schedule|model availability)\\b");
    private static final Pattern LEARNING = Pattern.compile(
            "(?i)\\b(teach(?: me)?|explain|quiz me|interview questions?|learning plan|tutor|study)\\b");
    private static final Pattern DOCUMENT = Pattern.compile(
            "(?i)\\b(uploaded (?:file|document)|pdf|my notes|this document|source material)\\b");
    private static final Pattern WRITING = Pattern.compile(
            "(?i)\\b(email|rewrite|resume|cover letter|formal response|social (?:media )?post|"
                    + "write (?:a )?message)\\b");
    private static final Pattern DATA = Pattern.compile(
            "(?i)\\b(csv|spreadsheet|metrics|statistics|dataframe|chart|aggregate|analytics)\\b");
    private static final Pattern AUTOMATION = Pattern.compile(
            "(?i)\\b(schedule (?:this|a job)|monitor (?:this|it)|repeatedly|run automatically|"
                    + "automate (?:this|the)|workflow|invoke (?:a )?tool|terminal execution)\\b");
    private static final Pattern CODE = Pattern.compile(
            "(?i)```|\\b(java|spring boot|react|typescript|javascript|python|sql|service method|"
                    + "constructor injection|component|controller|repository|function|class|api endpoint)\\b");
    private static final Pattern CODE_ACTION = Pattern.compile(
            "(?i)\\b(implement|write|create|build|refactor|fix|debug|patch)\\b.{0,80}\\b(code|java|"
                    + "spring|react|typescript|javascript|python|sql|function|class|algorithm)\\b|"
                    + "\\b(fix|debug|refactor)\\b.{0,80}```");
    private static final Pattern STRUCTURED = Pattern.compile(
            "(?i)\\b(json|schema|structured output|csv format|yaml)\\b");

    private final IntentClassifier legacyClassifier;

    public RequestClassifier(IntentClassifier legacyClassifier) {
        this.legacyClassifier = legacyClassifier;
    }

    public RequestClassification classify(RequestClassificationInput input) {
        String text = input.prompt();
        String mode = input.mode().toLowerCase(Locale.ROOT);
        List<ClassificationReason> reasons = new ArrayList<>();
        EnumSet<Capability> capabilities = EnumSet.of(Capability.TEXT);

        boolean localOnly = LOCAL_ONLY.matcher(text).find() || "private".equals(mode)
                || "private_local".equals(mode);
        if (localOnly) {
            reasons.add("private".equals(mode) || "private_local".equals(mode)
                    ? ClassificationReason.PRIVATE_MODE_SELECTED
                    : ClassificationReason.EXPLICIT_LOCAL_ONLY_REQUEST);
            capabilities.add(Capability.LOCAL_INFERENCE);
        }

        PrivacyLevel privacy = classifyPrivacy(text, localOnly, reasons);
        FreshnessRequirement freshness = classifyFreshness(text, reasons, capabilities);
        IntentType intent = classifyIntent(input, mode, text, localOnly, reasons, capabilities);

        if (input.useRag()) {
            capabilities.add(Capability.RAG);
            reasons.add(ClassificationReason.RAG_ENABLED);
        }
        if (STRUCTURED.matcher(text).find()) capabilities.add(Capability.STRUCTURED_OUTPUT);

        boolean longInput = text.length() > 4000;
        boolean largeContext = input.approximateContextLength() > 12000;
        if (longInput) reasons.add(ClassificationReason.LONG_PROMPT);
        if (largeContext) reasons.add(ClassificationReason.LARGE_CONTEXT);
        if (longInput || largeContext || intent == IntentType.REPOSITORY_ANALYSIS
                || intent == IntentType.DOCUMENT_QA || intent == IntentType.ARCHITECTURE) {
            capabilities.add(Capability.LONG_CONTEXT);
        }

        ComplexityLevel complexity = complexity(intent, text, longInput, largeContext, capabilities);
        double confidence = confidence(reasons, localOnly, input.hasImage());

        if (intent == IntentType.GENERAL_CHAT && reasons.isEmpty()) {
            return RequestClassification.conservativeFallback(privacy == PrivacyLevel.PERSONAL);
        }
        return new RequestClassification(intent, complexity, freshness, privacy,
                capabilities, confidence, reasons);
    }

    private IntentType classifyIntent(RequestClassificationInput input, String mode, String text,
                                      boolean localOnly, List<ClassificationReason> reasons,
                                      Set<Capability> capabilities) {
        if (localOnly) return IntentType.PRIVATE_LOCAL;
        if (input.hasImage()) {
            reasons.add(ClassificationReason.IMAGE_PRESENT);
            capabilities.add(Capability.VISION);
            if (CODE.matcher(text).find()) capabilities.add(Capability.CODE);
            return IntentType.VISION;
        }
        if (input.useRag() || DOCUMENT.matcher(text).find()) {
            if (!input.useRag()) reasons.add(ClassificationReason.DOCUMENT_LANGUAGE_MATCH);
            return IntentType.DOCUMENT_QA;
        }
        if (REPOSITORY.matcher(text).find()) {
            reasons.add(ClassificationReason.REPOSITORY_LANGUAGE_MATCH);
            capabilities.addAll(Set.of(Capability.CODE, Capability.LONG_CONTEXT, Capability.STRONG_REASONING));
            return DEBUG.matcher(text).find() ? IntentType.DEBUGGING : IntentType.REPOSITORY_ANALYSIS;
        }
        if (DEBUG.matcher(text).find()) {
            reasons.add(ClassificationReason.STACK_TRACE_DETECTED);
            capabilities.addAll(Set.of(Capability.CODE, Capability.STRONG_REASONING));
            return IntentType.DEBUGGING;
        }
        if (CURRENT.matcher(text).find()) {
            reasons.add(ClassificationReason.RESEARCH_LANGUAGE_MATCH);
            return IntentType.RESEARCH;
        }
        if (ARCHITECTURE.matcher(text).find() || "architect".equals(mode)) {
            reasons.add(ClassificationReason.ARCHITECTURE_LANGUAGE_MATCH);
            capabilities.add(Capability.STRONG_REASONING);
            return IntentType.ARCHITECTURE;
        }
        if (AUTOMATION.matcher(text).find()) {
            reasons.add(ClassificationReason.AUTOMATION_LANGUAGE_MATCH);
            capabilities.add(Capability.TOOL_CALLING);
            return IntentType.AUTOMATION;
        }
        if (DATA.matcher(text).find()) {
            reasons.add(ClassificationReason.DATA_LANGUAGE_MATCH);
            capabilities.add(Capability.STRONG_REASONING);
            return IntentType.DATA_ANALYSIS;
        }
        if (WRITING.matcher(text).find() || "writer".equals(mode)) {
            reasons.add(ClassificationReason.WRITING_LANGUAGE_MATCH);
            return IntentType.WRITING;
        }
        boolean learningLanguage = LEARNING.matcher(text).find()
                || Set.of("exam_tutor", "math_solver", "interview_prep", "explain_simply").contains(mode);
        boolean codeLanguage = CODE.matcher(text).find();
        // Intent and capability are orthogonal: explanatory requests remain
        // LEARNING even when examples require a code-capable model.
        if (learningLanguage && !CODE_ACTION.matcher(text).find()) {
            reasons.add(ClassificationReason.LEARNING_LANGUAGE_MATCH);
            if (codeLanguage) capabilities.add(Capability.CODE);
            if (!mode.isBlank() && !"general".equals(mode)) reasons.add(ClassificationReason.MODE_BIAS);
            return IntentType.LEARNING;
        }
        if (codeLanguage || CODE_ACTION.matcher(text).find() || "code_mentor".equals(mode)) {
            reasons.add(ClassificationReason.CODE_KEYWORD_MATCH);
            capabilities.add(Capability.CODE);
            return IntentType.CODING;
        }
        if (learningLanguage) {
            reasons.add(ClassificationReason.LEARNING_LANGUAGE_MATCH);
            if (!mode.isBlank() && !"general".equals(mode)) reasons.add(ClassificationReason.MODE_BIAS);
            return IntentType.LEARNING;
        }

        // Preserve legacy knowledge as a compatibility signal without changing its router behavior.
        Intent legacy = legacyClassifier.classify(text, input.mode(), input.useRag());
        if ("code".equals(legacy.category())) {
            reasons.add(ClassificationReason.CODE_KEYWORD_MATCH);
            capabilities.add(Capability.CODE);
            return IntentType.CODING;
        }
        if ("reasoning".equals(legacy.category()) || "math".equals(legacy.category())) {
            reasons.add(ClassificationReason.MODE_BIAS);
            capabilities.add(Capability.STRONG_REASONING);
            return IntentType.LEARNING;
        }
        if ("fast".equals(legacy.category()) && text.length() > 20) {
            capabilities.add(Capability.FAST_RESPONSE);
        }
        return IntentType.GENERAL_CHAT;
    }

    private PrivacyLevel classifyPrivacy(String text, boolean localOnly,
                                         List<ClassificationReason> reasons) {
        if (localOnly) return PrivacyLevel.LOCAL_ONLY;
        if (SENSITIVE.matcher(text).find()) {
            reasons.add(ClassificationReason.SENSITIVE_DATA_PATTERN);
            return PrivacyLevel.SENSITIVE;
        }
        if (PERSONAL.matcher(text).find()) {
            reasons.add(ClassificationReason.PERSONAL_CONTEXT_MATCH);
            return PrivacyLevel.PERSONAL;
        }
        return PrivacyLevel.PUBLIC;
    }

    private FreshnessRequirement classifyFreshness(String text, List<ClassificationReason> reasons,
                                                   Set<Capability> capabilities) {
        if (CURRENT.matcher(text).find()) {
            reasons.add(ClassificationReason.CURRENT_DATE_LANGUAGE);
            capabilities.add(Capability.WEB_SEARCH);
            return FreshnessRequirement.CURRENT_INFORMATION_REQUIRED;
        }
        return POSSIBLY_STALE.matcher(text).find()
                ? FreshnessRequirement.POSSIBLY_STALE : FreshnessRequirement.STABLE;
    }

    private ComplexityLevel complexity(IntentType intent, String text, boolean longInput,
                                       boolean largeContext, Set<Capability> capabilities) {
        if (largeContext || text.length() > 12000) return ComplexityLevel.VERY_HIGH;
        if (longInput || intent == IntentType.REPOSITORY_ANALYSIS || intent == IntentType.ARCHITECTURE
                || (intent == IntentType.DEBUGGING && capabilities.contains(Capability.LONG_CONTEXT))) {
            return ComplexityLevel.HIGH;
        }
        if (intent == IntentType.WRITING && text.length() < 500) return ComplexityLevel.LOW;
        if (intent == IntentType.GENERAL_CHAT && text.length() < 80) return ComplexityLevel.LOW;
        return ComplexityLevel.MEDIUM;
    }

    private double confidence(List<ClassificationReason> reasons, boolean explicit, boolean image) {
        if (explicit || image) return 0.96;
        if (reasons.size() >= 3) return 0.86;
        if (reasons.size() >= 1) return 0.72;
        return 0.45;
    }
}
