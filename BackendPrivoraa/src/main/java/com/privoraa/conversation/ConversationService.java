package com.privoraa.conversation;

import com.privoraa.auth.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.privoraa.auth.UserRepository;
import com.privoraa.common.ApiException;
import com.privoraa.conversation.dto.ConversationDetailDto;
import com.privoraa.conversation.dto.ConversationDto;
import com.privoraa.conversation.dto.CreateConversationRequest;
import com.privoraa.conversation.dto.UpdateConversationRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@Service
public class ConversationService {

    private static final Logger log = LoggerFactory.getLogger(ConversationService.class);

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public ConversationService(ConversationRepository conversationRepository,
                               MessageRepository messageRepository,
                               UserRepository userRepository, ObjectMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
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
        messages.stream().filter(m -> m.getRole() == MessageRole.ASSISTANT).forEach(m ->
                log.debug("Fetched assistant message conversationId={} assistantMessageId={} contentLength={}",
                        id, m.getId(), m.getContent() == null ? 0 : m.getContent().length()));
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

    @Transactional
    public int truncateFromMessage(String userId, String conversationId, String messageId) {
        requireOwned(userId, conversationId);
        Message message = messageRepository.findById(messageId)
                .filter(item -> item.getConversation().getId().equals(conversationId))
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        return messageRepository.deleteFrom(conversationId, message.getCreatedAt());
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
        return addUserMessage(conversationId, content, null, null, null, List.of(), List.of());
    }

    @Transactional
    public Message addUserMessage(String conversationId, String content, String clientMessageId) {
        return addUserMessage(conversationId, content, clientMessageId, null, null, List.of(), List.of());
    }

    @Transactional
    public Message addUserMessage(String conversationId, String content, String clientMessageId,
                                  String selectedModel, String selectedProvider, List<String> images,
                                  List<Map<String, Object>> attachments) {
        if (clientMessageId != null && !clientMessageId.isBlank()) {
            Message existing = messageRepository.findById(clientMessageId).orElse(null);
            if (existing != null) {
                if (!existing.getConversation().getId().equals(conversationId) || existing.getRole() != MessageRole.USER) {
                    throw ApiException.badRequest("Invalid message id");
                }
                return existing;
            }
        }
        Conversation convo = conversationRepository.findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("Conversation not found"));
        boolean firstUser = !messageRepository.existsByConversationIdAndRole(conversationId, MessageRole.USER);
        Message message = Message.builder()
                .id(clientMessageId == null || clientMessageId.isBlank() ? null : clientMessageId)
                .conversation(convo)
                .role(MessageRole.USER)
                .content(content)
                .modelUsed(selectedModel)
                .selectedProvider(selectedProvider)
                .imagesJson(writeJson(images))
                .attachmentsJson(writeJson(attachments))
                .build();
        Message saved = messageRepository.save(message);
        if (firstUser) {
            convo.setTitle(deriveTitle(content));
        }
        convo.setUpdatedAt(java.time.Instant.now());
        conversationRepository.save(convo);
        return saved;
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try { return objectMapper.writeValueAsString(value); }
        catch (Exception e) { throw ApiException.badRequest("Invalid attachment metadata"); }
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

    @Transactional
    public Message addAssistantMessage(String conversationId, String content, String model,
                                       String category, String routeReason, int promptTokens,
                                       int completionTokens, String completionStatus, String provider) {
        return addAssistantMessage(conversationId, content, model, category, routeReason, promptTokens,
                completionTokens, completionStatus, provider, null);
    }

    @Transactional
    public Message addAssistantMessage(String conversationId, String content, String model,
                                       String category, String routeReason, int promptTokens,
                                       int completionTokens, String completionStatus, String provider,
                                       String responsePlanJson) {
        Conversation convo = conversationRepository.getReferenceById(conversationId);
        Message message = Message.builder().conversation(convo).role(MessageRole.ASSISTANT)
                .content(content).modelUsed(model).category(category).routeReason(routeReason)
                .promptTokens(promptTokens).completionTokens(completionTokens)
                .completionStatus(completionStatus).selectedProvider(provider)
                .responsePlanJson(responsePlanJson).build();
        return messageRepository.save(message);
    }

    @Transactional(readOnly = true)
    public Message requireOwnedAssistant(String userId, String conversationId, String messageId) {
        requireOwned(userId, conversationId);
        return messageRepository.findById(messageId)
                .filter(message -> message.getConversation().getId().equals(conversationId))
                .filter(message -> message.getRole() == MessageRole.ASSISTANT)
                .orElseThrow(() -> ApiException.notFound("Assistant message not found"));
    }

    @Transactional
    public Message updateAssistantMessage(String userId, String conversationId, String messageId,
                                          String content, String model, String category, String routeReason,
                                          int promptTokens, int completionTokens, String completionStatus) {
        return updateAssistantMessage(userId, conversationId, messageId, content, model, category,
                routeReason, promptTokens, completionTokens, completionStatus, null);
    }

    @Transactional
    public Message updateAssistantMessage(String userId, String conversationId, String messageId,
                                          String content, String model, String category, String routeReason,
                                          int promptTokens, int completionTokens, String completionStatus,
                                          String provider) {
        return updateAssistantMessage(userId, conversationId, messageId, content, model, category,
                routeReason, promptTokens, completionTokens, completionStatus, provider, null);
    }

    @Transactional
    public Message updateAssistantMessage(String userId, String conversationId, String messageId,
                                          String content, String model, String category, String routeReason,
                                          int promptTokens, int completionTokens, String completionStatus,
                                          String provider, String responsePlanJson) {
        Message message = requireOwnedAssistant(userId, conversationId, messageId);
        message.setContent(content);
        message.setModelUsed(model);
        message.setCategory(category);
        message.setRouteReason(routeReason);
        message.setPromptTokens(promptTokens);
        message.setCompletionTokens(completionTokens);
        message.setCompletionStatus(completionStatus);
        if (provider != null) message.setSelectedProvider(provider);
        if (responsePlanJson != null) message.setResponsePlanJson(responsePlanJson);
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
