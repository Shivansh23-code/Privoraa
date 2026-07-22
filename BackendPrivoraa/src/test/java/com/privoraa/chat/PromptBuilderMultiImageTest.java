package com.privoraa.chat;

import com.privoraa.conversation.Conversation;
import com.privoraa.conversation.Message;
import com.privoraa.conversation.MessageRole;
import com.privoraa.rag.RagContext;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PromptBuilderMultiImageTest {
    @Test
    void preservesIndependentImageOrderInLatestUserMessage() {
        Message user = Message.builder().conversation(new Conversation()).role(MessageRole.USER).content("compare").build();
        List<Map<String, Object>> messages = new PromptBuilder().buildWithImages("general", List.of(user), RagContext.empty(),
                List.of("data:image/png;base64,one", "data:image/jpeg;base64,two"));
        Object content = messages.getLast().get("content");
        assertInstanceOf(List.class, content);
        List<?> parts = (List<?>) content;
        assertEquals(3, parts.size());
        assertEquals("data:image/png;base64,one", ((Map<?, ?>) ((Map<?, ?>) parts.get(1)).get("image_url")).get("url"));
        assertEquals("data:image/jpeg;base64,two", ((Map<?, ?>) ((Map<?, ?>) parts.get(2)).get("image_url")).get("url"));
    }
}
