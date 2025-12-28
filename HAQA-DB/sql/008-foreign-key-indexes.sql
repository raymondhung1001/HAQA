BEGIN;

-- Indexes on foreign keys that might be missing
-- These improve join performance and cascade delete performance

-- User foreign keys
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON haqa_schema.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_functions_user_id ON haqa_schema.user_functions(user_id);

-- Workflow foreign keys
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON haqa_schema.workflow_versions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_version_id ON haqa_schema.workflow_nodes(workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_source_node_id ON haqa_schema.workflow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_edges_target_node_id ON haqa_schema.workflow_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_version_id ON haqa_schema.workflow_executions(workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_triggered_by_user_id ON haqa_schema.workflow_executions(triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_node_execution_logs_execution_id ON haqa_schema.node_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_node_execution_logs_node_id ON haqa_schema.node_execution_logs(node_id);

-- Partial indexes for active records (performance optimization)
CREATE INDEX IF NOT EXISTS idx_users_active_true ON haqa_schema.users(id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflows_active_true ON haqa_schema.workflows(id) WHERE is_active = TRUE;

-- Index for expired role/function lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_not_expired ON haqa_schema.user_roles(user_id, role_id) 
WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_user_functions_not_expired ON haqa_schema.user_functions(user_id, function_id) 
WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

COMMIT;

