package com.privoraa.chat;

import com.privoraa.auth.PrivoraaUserDetails;
import com.privoraa.chat.dto.ChatRequest;
import com.privoraa.chat.dto.ChatResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/chat")
@Tag(name = "Chat", description = "Streaming and non-streaming multi-model chat")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Stream a chat completion as SSE (events: meta, token, done, error)")
    public SseEmitter stream(@AuthenticationPrincipal PrivoraaUserDetails user,
                             @Valid @RequestBody ChatRequest request) {
        return chatService.stream(user.getId(), request);
    }

    @PostMapping
    @Operation(summary = "Non-streaming chat completion")
    public ChatResponse chat(@AuthenticationPrincipal PrivoraaUserDetails user,
                             @Valid @RequestBody ChatRequest request) {
        return chatService.chat(user.getId(), request);
    }
}
