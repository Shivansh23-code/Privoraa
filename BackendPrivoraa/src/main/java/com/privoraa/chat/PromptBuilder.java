package com.privoraa.chat;

import com.privoraa.conversation.Message;
import com.privoraa.conversation.MessageRole;
import com.privoraa.rag.RagContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Assembles the OpenAI-style message array: system persona + RAG context + history. */
@Component
public class PromptBuilder {

    /** Keep the last N turns to bound prompt size / cost. */
    private static final int MAX_HISTORY = 12;

    public List<Map<String, String>> build(String mode, List<Message> history, RagContext rag) {
        List<Map<String, String>> messages = new ArrayList<>();

        StringBuilder system = new StringBuilder(Modes.systemPrompt(mode));
        if (rag != null && rag.hasContext()) {
            system.append("\n\nThe user has provided notes. Answer using ONLY the context below and "
                    + "cite sources inline as [1], [2], etc. If the answer is not in the context, say "
                    + "\"I couldn't find that in your notes.\"\n\nContext:\n")
                    .append(rag.contextBlock());
        }
        messages.add(msg("system", system.toString()));

        List<Message> recent = history.size() > MAX_HISTORY
                ? history.subList(history.size() - MAX_HISTORY, history.size())
                : history;

        for (Message m : recent) {
            if (m.getRole() == MessageRole.SYSTEM) {
                continue;
            }
            String role = m.getRole() == MessageRole.ASSISTANT ? "assistant" : "user";
            messages.add(msg(role, m.getContent()));
        }
        return messages;
    }

    public int estimatePromptTokens(List<Map<String, String>> messages) {
        int chars = 0;
        for (Map<String, String> m : messages) {
            chars += m.getOrDefault("content", "").length();
        }
        return Math.max(1, chars / 4); // ~4 chars per token
    }

    private Map<String, String> msg(String role, String content) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }
}
