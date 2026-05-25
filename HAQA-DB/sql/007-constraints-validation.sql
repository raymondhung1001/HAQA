BEGIN;

CREATE TABLE IF NOT EXISTS haqa_schema.schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE
    migration_version CONSTANT VARCHAR(100) := '20260525_constraint_validation_v2';
BEGIN
    IF EXISTS (
        SELECT 1
        FROM haqa_schema.schema_migrations
        WHERE version = migration_version
    ) THEN
        RAISE NOTICE 'Constraint migration % already applied. Skipping.', migration_version;
        RETURN;
    END IF;

    -- Add constraints quickly, then validate in a separate lock profile.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_roles_expires_after_granted_check'
          AND conrelid = 'haqa_schema.user_roles'::regclass
    ) THEN
        ALTER TABLE haqa_schema.user_roles
        ADD CONSTRAINT user_roles_expires_after_granted_check
        CHECK (expires_at IS NULL OR expires_at > granted_at) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_roles_expires_after_granted_check'
          AND conrelid = 'haqa_schema.user_roles'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.user_roles
        VALIDATE CONSTRAINT user_roles_expires_after_granted_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_functions_expires_after_granted_check'
          AND conrelid = 'haqa_schema.user_functions'::regclass
    ) THEN
        ALTER TABLE haqa_schema.user_functions
        ADD CONSTRAINT user_functions_expires_after_granted_check
        CHECK (expires_at IS NULL OR expires_at > granted_at) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_functions_expires_after_granted_check'
          AND conrelid = 'haqa_schema.user_functions'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.user_functions
        VALIDATE CONSTRAINT user_functions_expires_after_granted_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_executions_status_check'
          AND conrelid = 'haqa_schema.test_flow_executions'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_executions
        ADD CONSTRAINT test_flow_executions_status_check
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_executions_status_check'
          AND conrelid = 'haqa_schema.test_flow_executions'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_executions
        VALIDATE CONSTRAINT test_flow_executions_status_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_node_execution_logs_status_check'
          AND conrelid = 'haqa_schema.test_flow_node_execution_logs'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_node_execution_logs
        ADD CONSTRAINT test_flow_node_execution_logs_status_check
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_node_execution_logs_status_check'
          AND conrelid = 'haqa_schema.test_flow_node_execution_logs'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_node_execution_logs
        VALIDATE CONSTRAINT test_flow_node_execution_logs_status_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_executions_time_check'
          AND conrelid = 'haqa_schema.test_flow_executions'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_executions
        ADD CONSTRAINT test_flow_executions_time_check
        CHECK (end_time IS NULL OR end_time >= start_time) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_executions_time_check'
          AND conrelid = 'haqa_schema.test_flow_executions'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_executions
        VALIDATE CONSTRAINT test_flow_executions_time_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_node_execution_logs_time_check'
          AND conrelid = 'haqa_schema.test_flow_node_execution_logs'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_node_execution_logs
        ADD CONSTRAINT test_flow_node_execution_logs_time_check
        CHECK (end_time IS NULL OR end_time >= start_time) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_node_execution_logs_time_check'
          AND conrelid = 'haqa_schema.test_flow_node_execution_logs'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_node_execution_logs
        VALIDATE CONSTRAINT test_flow_node_execution_logs_time_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_versions_version_positive_check'
          AND conrelid = 'haqa_schema.test_flow_versions'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_versions
        ADD CONSTRAINT test_flow_versions_version_positive_check
        CHECK (version_number > 0) NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'test_flow_versions_version_positive_check'
          AND conrelid = 'haqa_schema.test_flow_versions'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_versions
        VALIDATE CONSTRAINT test_flow_versions_version_positive_check;
    END IF;

    -- Migrate legacy FK names to version-aware composite FKs.
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_edges_source'
          AND conrelid = 'haqa_schema.test_flow_edges'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_edges
        DROP CONSTRAINT fk_edges_source;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_edges_source_version'
          AND conrelid = 'haqa_schema.test_flow_edges'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_edges
        ADD CONSTRAINT fk_edges_source_version
        FOREIGN KEY (source_node_id, test_flow_version_id)
        REFERENCES haqa_schema.test_flow_nodes(id, test_flow_version_id)
        NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_edges_source_version'
          AND conrelid = 'haqa_schema.test_flow_edges'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_edges
        VALIDATE CONSTRAINT fk_edges_source_version;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_edges_target'
          AND conrelid = 'haqa_schema.test_flow_edges'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_edges
        DROP CONSTRAINT fk_edges_target;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_edges_target_version'
          AND conrelid = 'haqa_schema.test_flow_edges'::regclass
    ) THEN
        ALTER TABLE haqa_schema.test_flow_edges
        ADD CONSTRAINT fk_edges_target_version
        FOREIGN KEY (target_node_id, test_flow_version_id)
        REFERENCES haqa_schema.test_flow_nodes(id, test_flow_version_id)
        NOT VALID;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_edges_target_version'
          AND conrelid = 'haqa_schema.test_flow_edges'::regclass
          AND NOT convalidated
    ) THEN
        ALTER TABLE haqa_schema.test_flow_edges
        VALIDATE CONSTRAINT fk_edges_target_version;
    END IF;

    INSERT INTO haqa_schema.schema_migrations(version, name)
    VALUES (
        migration_version,
        'Constraint validation v2 with NOT VALID/VALIDATE and version-aware edge FKs'
    );
END $$;

COMMIT;

