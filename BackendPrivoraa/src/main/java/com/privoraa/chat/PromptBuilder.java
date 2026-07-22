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

    public List<Map<String, Object>> build(String mode, List<Message> history, RagContext rag) {
        return build(mode, history, rag, null);
    }

    /**
     * Build the message array. When {@code image} is non-null, the latest user
     * message is sent as a multimodal content array (text + image_url) so a vision
     * model can "see" the attachment. Content is typed as Object because OpenRouter
     * accepts either a String or an array of parts per message.
     */
    public List<Map<String, Object>> build(String mode, List<Message> history, RagContext rag, String image) {
        return buildWithImages(mode, history, rag, image == null ? List.of() : List.of(image));
    }

    public List<Map<String, Object>> buildWithImages(String mode, List<Message> history, RagContext rag, List<String> images) {
        List<Map<String, Object>> messages = new ArrayList<>();

        StringBuilder system = new StringBuilder(Modes.systemPrompt(mode));
        if (rag != null && rag.hasContext()) {
            system.append("\n\nThe user has provided notes. Answer using ONLY the context below and "
                    + "cite sources inline as [1], [2], etc. If the answer is not in the context, say "
                    + "\"I couldn't find that in your notes.\"\n\nContext:\n")
                    .append(rag.contextBlock());
        }
        messages.add(textMsg("system", system.toString()));

        List<Message> recent = history.size() > MAX_HISTORY
                ? history.subList(history.size() - MAX_HISTORY, history.size())
                : history;

        for (Message m : recent) {
            if (m.getRole() == MessageRole.SYSTEM) {
                continue;
            }
            String role = m.getRole() == MessageRole.ASSISTANT ? "assistant" : "user";
            messages.add(textMsg(role, m.getContent()));
        }

        // Attach the image to the most recent user message (the current turn).
        if (images != null && !images.isEmpty()) {
            attachImagesToLastUserMessage(messages, images);
        }
        return messages;
    }

    public int estimatePromptTokens(List<Map<String, Object>> messages) {
        int chars = 0;
        for (Map<String, Object> m : messages) {
            Object content = m.get("content");
            if (content instanceof String s) {
                chars += s.length();
            } else if (content instanceof List<?> parts) {
                for (Object part : parts) {
                    if (part instanceof Map<?, ?> p && p.get("text") instanceof String t) {
                        chars += t.length();
                    }
                }
            }
        }
        return Math.max(1, chars / 4); // ~4 chars per token (image tokens not counted here)
    }

    @SuppressWarnings("unchecked")
    private void attachImagesToLastUserMessage(List<Map<String, Object>> messages, List<String> images) {
        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, Object> m = messages.get(i);
            if ("user".equals(m.get("role"))) {
                String text = m.get("content") instanceof String s ? s : "";
                List<Map<String, Object>> parts = new ArrayList<>();
                if (!text.isBlank()) {
                    parts.add(Map.of("type", "text", "text", text));
                }
                images.stream().filter(image -> image != null && !image.isBlank()).limit(8)
                        .forEach(image -> parts.add(Map.of("type", "image_url", "image_url", Map.of("url", image))));
                m.put("content", parts);
                return;
            }
        }
    }

    private Map<String, Object> textMsg(String role, String content) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }
}
