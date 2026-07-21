package com.privoraa.conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, String> {

    List<Message> findByConversationIdOrderByCreatedAtAsc(String conversationId);

    boolean existsByConversationIdAndRole(String conversationId, MessageRole role);

    /** Assistant messages for a user since an instant — basis for the usage dashboard. */
    @Query("""
            select m from Message m
            where m.conversation.user.id = :userId
              and m.role = com.privoraa.conversation.MessageRole.ASSISTANT
              and m.createdAt >= :since
            order by m.createdAt asc
            """)
    List<Message> findAssistantMessagesSince(@Param("userId") String userId, @Param("since") Instant since);

    @Query("""
            select coalesce(sum(m.promptTokens + m.completionTokens), 0)
            from Message m
            where m.conversation.user.id = :userId
            """)
    long totalTokensForUser(@Param("userId") String userId);

    @Query("""
            select count(m)
            from Message m
            where m.conversation.user.id = :userId
              and m.role = com.privoraa.conversation.MessageRole.ASSISTANT
            """)
    long totalRequestsForUser(@Param("userId") String userId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM Message m WHERE m.conversation.id = :conversationId")
    int deleteAllByConversationId(@Param("conversationId") String conversationId);
}
