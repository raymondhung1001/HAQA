BEGIN;

-- Validate expires_at is after granted_at for user_roles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_roles_expires_after_granted_check'
    ) THEN
        ALTER TABLE haqa_schema.user_roles
        ADD CONSTRAINT user_roles_expires_after_granted_check
        CHECK (expires_at IS NULL OR expires_at > granted_at);
    END IF;
END $$;

-- Validate expires_at is after granted_at for user_functions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_functions_expires_after_granted_check'
    ) THEN
        ALTER TABLE haqa_schema.user_functions
        ADD CONSTRAINT user_functions_expires_after_granted_check
        CHECK (expires_at IS NULL OR expires_at > granted_at);
    END IF;
END $$;

-- Validate workflow execution status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workflow_executions_status_check'
    ) THEN
        ALTER TABLE haqa_schema.workflow_executions
        ADD CONSTRAINT workflow_executions_status_check
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'));
    END IF;
END $$;

-- Validate node execution status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'node_execution_logs_status_check'
    ) THEN
        ALTER TABLE haqa_schema.node_execution_logs
        ADD CONSTRAINT node_execution_logs_status_check
        CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'));
    END IF;
END $$;

-- Validate end_time is after start_time for executions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workflow_executions_time_check'
    ) THEN
        ALTER TABLE haqa_schema.workflow_executions
        ADD CONSTRAINT workflow_executions_time_check
        CHECK (end_time IS NULL OR end_time >= start_time);
    END IF;
END $$;

-- Validate end_time is after start_time for node logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'node_execution_logs_time_check'
    ) THEN
        ALTER TABLE haqa_schema.node_execution_logs
        ADD CONSTRAINT node_execution_logs_time_check
        CHECK (end_time IS NULL OR end_time >= start_time);
    END IF;
END $$;

-- Validate version_number is positive
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workflow_versions_version_positive_check'
    ) THEN
        ALTER TABLE haqa_schema.workflow_versions
        ADD CONSTRAINT workflow_versions_version_positive_check
        CHECK (version_number > 0);
    END IF;
END $$;

COMMIT;

