-- Per-user active chat model (the model the Ollama provider runs for that user).
-- One row per user; absence means "fall back to the configured default model".
CREATE TABLE user_model_prefs (
    user_id      CHAR(36)     NOT NULL,
    active_model VARCHAR(120) NOT NULL,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_ump_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
