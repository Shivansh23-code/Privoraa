package com.privoraa.conversation;

import com.privoraa.auth.User;
import com.privoraa.auth.UserRepository;
import com.privoraa.common.ApiException;
import com.privoraa.conversation.dto.ConversationDetailDto;
import com.privoraa.conversation.dto.ConversationDto;
import com.privoraa.conversation.dto.CreateConversationRequest;
import com.privoraa.conversation.dto.UpdateConversationRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;

    public ConversationService(ConversationRepository conversationRepository,
                               MessageRepository messageRepository,
                               UserRepository userRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> list(String userId) {
        return conversationRepository.findByUserIdOrderByPinnedDescUpdatedAtDesc(userId)
                .stream().map(ConversationDto::from).toList();
    }

    @Transactional
    public ConversationDto create(String userId, CreateConversationRequest req) {
        String mode = req.mode() == null ? "general" : req.mode();
        String title = req.title() == null ? "New chat" : req.title();
        String clientId = req.id();
        if (clientId != null) {
            Conversation existing = conversationRepository.findByIdAndUserId(clientId, userId).orElse(null);
            if (existing != null) {
                return ConversationDto.from(existing);
            }
            if (!conversationRepository.existsById(clientId)) {
                Conversation convo = newConversation(userId, mode, title);
                convo.setId(clientId);
                return ConversationDto.from(conversationRepository.save(convo));
            }
        }
        Conversation convo = newConversation(userId, mode, title);
        return ConversationDto.from(conversationRepository.save(convo));
    }

    @Transactional(readOnly = true)
    public ConversationDetailDto getDetail(String userId, String id) {
        Conversation convo = requireOwned(userId, id);
        List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(id);
        return ConversationDetailDto.from(convo, messages);
    }

    @Transactional
    public ConversationDto update(String userId, String id, UpdateConversationRequest req) {
        Conversation convo = requireOwned(userId, id);
        if (req.title() != null && !req.title().isBlank()) {
            convo.setTitle(req.title().trim());
        }
        if (req.pinned() != null) {
            convo.setPinned(req.pinned());
        }
        return ConversationDto.from(conversationRepository.save(convo));
    }

    @Transactional
    public void delete(String userId, String id) {
        Conversation convo = requireOwned(userId, id);
        messageRepository.deleteAllByConversationId(id);
        messageRepository.flush();
        conversationRepository.delete(convo);
        conversationRepository.flush();
    }

    /**
     * Resolve an existing owned conversation, or create one — adopting the
     * client-supplied id when given. The frontend is offline-first and generates
     * the conversation UUID locally before the backend has ever seen it, so the
     * first chat message arrives with an id that doesn't exist yet; create it
     * with that id rather than 404'ing ("Conversation not found").
     */
    @Transactional
    public Conversation getOrCreate(String userId, String conversationId, String mode) {
        if (conversationId != null && !conversationId.isBlank()) {
            return conversationRepository.findByIdAndUserId(conversationId, userId)
                    .orElseGet(() -> {
                        Conversation convo = newConversation(userId,
                                mode == null ? "general" : mode, "New chat");
                        convo.setId(conversationId);
                        return conversationRepository.save(convo);
                    });
        }
        Conversation convo = newConversation(userId, mode == null ? "general" : mode, "New chat");
        return conversationRepository.save(convo);
    }

    @Transactional(readOnly = true)
    public Conversation requireOwned(String userId, String id) {
        return conversationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("Conversation not found"));
    }

    @Transactional(readOnly = true)
    public List<Message> messages(String conversationId) {
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    @Transactional
    public Message addUserMessage(String conversationId, String content) {
        Conversation convo = conversationRepository.findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("Conversation not found"));
        boolean firstUser = !messageRepository.existsByConversationIdAndRole(conversationId, MessageRole.USER);
        Message message = Message.builder()
                .conversation(convo)
                .role(MessageRole.USER)
                .content(content)
                .build();
        Message saved = messageRepository.save(message);
        if (firstUser) {
            convo.setTitle(deriveTitle(content));
        }
        convo.setUpdatedAt(java.time.Instant.now());
        conversationRepository.save(convo);
        return saved;
    }

    @Transactional
    public Message addAssistantMessage(String conversationId, String content, String model,
                                       String category, String routeReason,
                                       int promptTokens, int completionTokens) {
        Conversation convo = conversationRepository.getReferenceById(conversationId);
        Message message = Message.builder()
                .conversation(convo)
                .role(MessageRole.ASSISTANT)
                .content(content)
                .modelUsed(model)
                .category(category)
                .routeReason(routeReason)
                .promptTokens(promptTokens)
                .completionTokens(completionTokens)
                .build();
        return messageRepository.save(message);
    }

    private Conversation newConversation(String userId, String mode, String title) {
        User userRef = userRepository.getReferenceById(userId);
        return Conversation.builder()
                .user(userRef)
                .mode(mode)
                .title(title == null || title.isBlank() ? "New chat" : title)
                .pinned(false)
                .build();
    }

    private String deriveTitle(String content) {
        String clean = content == null ? "" : content.replaceAll("\\s+", " ").trim();
        if (clean.isEmpty()) {
            return "New chat";
        }
        return clean.length() > 42 ? clean.substring(0, 42) + "…" : clean;
    }
}
