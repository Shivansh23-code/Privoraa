package com.privoraa.conversation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.auth.Plan;
import com.privoraa.auth.Role;
import com.privoraa.auth.User;
import com.privoraa.auth.UserRepository;
import com.privoraa.chat.SemanticResponsePlanner;
import com.privoraa.conversation.dto.MessageDto;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlannedResponsePersistenceIntegrationTest {
    @Autowired private ConversationRepository conversations;
    @Autowired private MessageRepository messages;
    @Autowired private UserRepository users;
    @Autowired private TestEntityManager entityManager;

    @Test
    void finalContinuationReplacesPersistedFirstSegmentPlanOnSameAssistantRow() {
        User user = users.save(User.builder().email("plan@test.invalid").passwordHash("hash")
                .role(Role.USER).plan(Plan.FREE).build());
        Conversation conversation = conversations.save(Conversation.builder().user(user)
                .title("Plan test").mode("general").build());
        ConversationService service = new ConversationService(conversations, messages, users, new ObjectMapper());
        SemanticResponsePlanner planner = new SemanticResponsePlanner();
        SemanticResponsePlanner.Plan first = planner.plan(
                "Create an API including Entity, DTO, Repository, Service, Controller, Validation, Security, and Tests",
                2048);
        assertNotNull(first);

        Message saved = service.addAssistantMessage(conversation.getId(), "First segment.", "model-1",
                "code", "planned", 100, 500, "partial", "openrouter", planner.write(first));
        String assistantId = saved.getId();
        SemanticResponsePlanner.Plan last = first.advance();
        service.updateAssistantMessage(user.getId(), conversation.getId(), assistantId,
                "First segment. Final segment.", "model-1", "code", "planned",
                140, 800, "complete", "openrouter", planner.write(last));
        entityManager.flush();
        entityManager.clear();

        Message reloaded = messages.findById(assistantId).orElseThrow();
        SemanticResponsePlanner.Plan persisted = planner.read(reloaded.getResponsePlanJson());
        MessageDto dto = MessageDto.from(reloaded);
        assertEquals(assistantId, reloaded.getId());
        assertEquals("complete", reloaded.getCompletionStatus());
        assertEquals(2, persisted.segmentIndex());
        assertFalse(persisted.hasRemainingContent());
        assertTrue(persisted.remainingSections().isEmpty());
        assertEquals(2, dto.responsePlan().get("segmentIndex"));
    }
}
