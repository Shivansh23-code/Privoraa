ALTER TABLE messages ADD COLUMN selected_provider VARCHAR(40);
ALTER TABLE messages ADD COLUMN images_json LONGTEXT;
ALTER TABLE messages ADD COLUMN attachments_json LONGTEXT;
