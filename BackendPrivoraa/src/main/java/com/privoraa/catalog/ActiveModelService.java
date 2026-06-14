package com.privoraa.catalog;

import com.privoraa.config.OllamaProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Reads/writes a user's active chat model. Defaults to the configured Ollama chat
 * model when the user has not chosen one. Phase 3 wires ChatService to this.
 */
@Service
public class ActiveModelService {

    private final UserModelPrefRepository repo;
    private final OllamaProperties ollamaProps;

    public ActiveModelService(UserModelPrefRepository repo, OllamaProperties ollamaProps) {
        this.repo = repo;
        this.ollamaProps = ollamaProps;
    }

    /** The user's active model, or the configured default if unset. */
    @Transactional(readOnly = true)
    public String activeFor(String userId) {
        return repo.findById(userId)
                .map(UserModelPref::getActiveModel)
                .orElse(ollamaProps.chatModel());
    }

    @Transactional
    public String setActive(String userId, String tag) {
        UserModelPref pref = repo.findById(userId).orElseGet(() -> {
            UserModelPref p = new UserModelPref();
            p.setUserId(userId);
            return p;
        });
        pref.setActiveModel(tag);
        pref.setUpdatedAt(Instant.now());
        repo.save(pref);
        return tag;
    }
}
