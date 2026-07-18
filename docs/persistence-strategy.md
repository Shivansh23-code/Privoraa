# Persistence Strategy

## Phase 2 decision

MySQL/JPA remains Privoraa’s authoritative application database. Existing users, conversations, messages, documents, chunks, and model preferences remain unchanged. Redis remains transient cache/rate-limit infrastructure and is not authoritative.

No MongoDB dependency, configuration, container, environment variable, collection, or dual-write path is introduced. Adding MongoDB now would create a third conversation source of truth alongside persisted frontend Zustand state and backend MySQL records.

The client/server conversation divergence must be resolved before splitting application persistence. A future decision should define which conversations are server-authoritative, which are explicitly local-only, cache/version semantics, synchronization, deletion, conflict resolution, and migration/rollback behavior.

## Future storage roles

- MySQL can continue to own transactional identities, authorization, workspace relationships, conversation records, billing, and audit references. JSON columns may hold bounded flexible message/routing metadata where relational columns are unnecessarily rigid.
- Vector storage should be evaluated independently using corpus size, retrieval latency, filtering, backup, portability, and operational evidence. It need not determine the primary application database.
- Object storage is appropriate for original uploads, repository archives, and large versioned artifacts, with relational ownership and integrity metadata retained in MySQL.
- Redis may support caches, leases, queues, and distributed limits, but durable state must survive Redis loss.

MongoDB may be reconsidered only after measured access patterns, data volume, schema variability, query/index requirements, backup/restore needs, team expertise, and operational readiness demonstrate a benefit that outweighs consistency and deployment cost.
