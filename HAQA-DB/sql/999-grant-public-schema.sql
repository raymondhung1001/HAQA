BEGIN;

-- Ensure schema usage is granted (may already be granted in 001-db-init.sql, but ensure it's set)
GRANT USAGE ON SCHEMA haqa_schema TO haqa_app;

-- Grant permissions on all existing objects
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA haqa_schema TO haqa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA haqa_schema TO haqa_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA haqa_schema TO haqa_app;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA haqa_schema
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO haqa_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA haqa_schema
GRANT USAGE, SELECT ON SEQUENCES TO haqa_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA haqa_schema
GRANT EXECUTE ON FUNCTIONS TO haqa_app;

COMMIT;