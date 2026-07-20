package com.privoraa.conversation;

import com.privoraa.auth.User;
import com.privoraa.auth.UserRepository;
import com.privoraa.common.ApiException;
import com.privoraa.conversation.dto.ConversationDetailDto;
import com.privoraa.conversation.dto.ConversationDto;
import com.privoraa.conversation.dto.CreateConversationRequest;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ConversationServiceTest {

    private final ConversationRepository repo = mock(ConversationRepository.class);
    private final MessageRepository msgRepo = mock(MessageRepository.class);
    private final UserRepository userRepo = mock(UserRepository.class);
    private final ConversationService service = new ConversationService(repo, msgRepo, userRepo);

    private User user(String id) {
        User u = new User();
        u.setId(id);
        return u;
    }

    private Conversation conversation(String id, String userId, String title) {
        Conversation c = new Conversation();
        c.setId(id);
        c.setUser(user(userId));
        c.setTitle(title);
        c.setMode("general");
        c.setPinned(false);
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        return c;
    }

    @Test
    void createWithClientIdUsesSuppliedId() {
        when(userRepo.getReferenceById("user-1")).thenReturn(user("user-1"));
        when(repo.findByIdAndUserId("client-id", "user-1")).thenReturn(Optional.empty());
        when(repo.existsById("client-id")).thenReturn(false);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));

        ConversationDto dto = service.create("user-1", new CreateConversationRequest("client-id", "Test", "general"));

        assertEquals("client-id", dto.id());
        assertEquals("Test", dto.title());
        verify(repo).save(argThat(c -> "client-id".equals(c.getId())));
    }

    @Test
    void createWithoutClientIdGeneratesNewId() {
        when(userRepo.getReferenceById("user-1")).thenReturn(user("user-1"));
        when(repo.save(any())).thenAnswer(i -> {
            Conversation c = i.getArgument(0);
            if (c.getId() == null) c.setId(java.util.UUID.randomUUID().toString());
            return c;
        });

        ConversationDto dto = service.create("user-1", new CreateConversationRequest(null, null, null));

        assertNotNull(dto.id());
        verify(repo).save(any());
    }

    @Test
    void userCannotReadAnotherUsersConversation() {
        when(repo.findByIdAndUserId("convo-1", "user-2")).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> service.getDetail("user-2", "convo-1"));
    }

    @Test
    void userCannotDeleteAnotherUsersConversation() {
        when(repo.findByIdAndUserId("convo-1", "user-2")).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> service.delete("user-2", "convo-1"));
    }

    @Test
    void userCannotUpdateAnotherUsersConversation() {
        when(repo.findByIdAndUserId("convo-1", "user-2")).thenReturn(Optional.empty());

        assertThrows(ApiException.class, () -> service.update("user-2", "convo-1", null));
    }

    @Test
    void getDetailReturnsConversationWithMessages() {
        Conversation convo = conversation("convo-1", "user-1", "Hello");
        Message msg = Message.builder()
                .id("msg-1")
                .conversation(convo)
                .role(MessageRole.USER)
                .content("Hi")
                .promptTokens(10)
                .completionTokens(0)
                .costMicros(0)
                .createdAt(Instant.now())
                .build();
        when(repo.findByIdAndUserId("convo-1", "user-1")).thenReturn(Optional.of(convo));
        when(msgRepo.findByConversationIdOrderByCreatedAtAsc("convo-1")).thenReturn(List.of(msg));

        ConversationDetailDto detail = service.getDetail("user-1", "convo-1");

        assertEquals("convo-1", detail.id());
        assertEquals(1, detail.messages().size());
        assertEquals("msg-1", detail.messages().get(0).id());
    }

    @Test
    void createWithExistingClientIdReturnsExisting() {
        Conversation existing = conversation("client-id", "user-1", "Existing chat");
        when(repo.findByIdAndUserId("client-id", "user-1")).thenReturn(Optional.of(existing));

        ConversationDto dto = service.create("user-1", new CreateConversationRequest("client-id", "New title", "general"));

        assertEquals("client-id", dto.id());
        assertEquals("Existing chat", dto.title());
        assertEquals("general", dto.mode());
        verify(repo, never()).save(any());
    }
}
