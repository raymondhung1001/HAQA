BEGIN;

-- Install pg_uuidv7 extension in haqa_schema
CREATE EXTENSION IF NOT EXISTS pg_uuidv7 SCHEMA haqa_schema;

COMMIT;

