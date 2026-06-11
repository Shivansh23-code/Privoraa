CREATE TABLE users (
    id            CHAR(36)     NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(120),
    role          VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE conversations (
    id         CHAR(36)     NOT NULL,
    user_id    CHAR(36)     NOT NULL,
    title      VARCHAR(255) NOT NULL DEFAULT 'New chat',
    mode       VARCHAR(40)  NOT NULL DEFAULT 'general',
    pinned     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_conv_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_conv_user ON conversations (user_id);
CREATE INDEX idx_conv_updated ON conversations (updated_at);

CREATE TABLE messages (
    id               CHAR(36)    NOT NULL,
    conversation_id  CHAR(36)    NOT NULL,
    role             VARCHAR(20) NOT NULL,
    content          LONGTEXT    NOT NULL,
    model_used       VARCHAR(120),
    category         VARCHAR(40),
    route_reason     VARCHAR(255),
    prompt_tokens    INT         NOT NULL DEFAULT 0,
    completion_tokens INT        NOT NULL DEFAULT 0,
    cost_micros      BIGINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);
CREATE INDEX idx_msg_conv ON messages (conversation_id);
CREATE INDEX idx_msg_created ON messages (created_at);

CREATE TABLE documents (
    id            CHAR(36)     NOT NULL,
    user_id       CHAR(36)     NOT NULL,
    filename      VARCHAR(255) NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'PROCESSING',
    chunk_count   INT          NOT NULL DEFAULT 0,
    error_message VARCHAR(500),
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_doc_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_doc_user ON documents (user_id);

CREATE TABLE document_chunks (
    id          CHAR(36) NOT NULL,
    document_id CHAR(36) NOT NULL,
    chunk_index INT      NOT NULL,
    content     LONGTEXT NOT NULL,
    embedding   LONGTEXT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_chunk_doc FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
);
CREATE INDEX idx_chunk_doc ON document_chunks (document_id);
