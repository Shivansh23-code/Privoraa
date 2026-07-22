package com.privoraa.conversation;

import com.privoraa.auth.PrivoraaUserDetails;
import com.privoraa.conversation.dto.ConversationDetailDto;
import com.privoraa.conversation.dto.ConversationDto;
import com.privoraa.conversation.dto.CreateConversationRequest;
import com.privoraa.conversation.dto.UpdateConversationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/conversations")
@Tag(name = "Conversations", description = "Chat history: create, list, rename, pin, delete")
public class ConversationController {

    private final ConversationService service;

    public ConversationController(ConversationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List the current user's conversations")
    public List<ConversationDto> list(@AuthenticationPrincipal PrivoraaUserDetails user) {
        return service.list(user.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create an empty conversation")
    public ConversationDto create(@AuthenticationPrincipal PrivoraaUserDetails user,
                                  @Valid @RequestBody(required = false) CreateConversationRequest req) {
        return service.create(user.getId(), req == null
                ? new CreateConversationRequest(null, null) : req);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a conversation with its messages")
    public ConversationDetailDto get(@AuthenticationPrincipal PrivoraaUserDetails user,
                                     @PathVariable String id) {
        return service.getDetail(user.getId(), id);
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Rename or pin/unpin a conversation")
    public ConversationDto update(@AuthenticationPrincipal PrivoraaUserDetails user,
                                  @PathVariable String id,
                                  @Valid @RequestBody UpdateConversationRequest req) {
        return service.update(user.getId(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a conversation and its messages")
    public void delete(@AuthenticationPrincipal PrivoraaUserDetails user, @PathVariable String id) {
        service.delete(user.getId(), id);
    }

    @DeleteMapping("/{id}/messages/{messageId}/from")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete the selected message and all later messages")
    public void truncateFrom(@AuthenticationPrincipal PrivoraaUserDetails user,
                             @PathVariable String id, @PathVariable String messageId) {
        service.truncateFromMessage(user.getId(), id, messageId);
    }
}
