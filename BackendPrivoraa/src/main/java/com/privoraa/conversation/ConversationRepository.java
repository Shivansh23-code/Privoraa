package com.privoraa.conversation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, String> {

    List<Conversation> findByUserIdOrderByPinnedDescUpdatedAtDesc(String userId);

    Optional<Conversation> findByIdAndUserId(String id, String userId);
}
