-- Subscription tier per user. Gates which catalog models may be downloaded.
-- (The h2 profile builds the schema via Hibernate ddl-auto; this migration is
--  for the MySQL/prod profile, where Flyway owns the schema.)
ALTER TABLE users ADD COLUMN plan VARCHAR(20) NOT NULL DEFAULT 'FREE';
