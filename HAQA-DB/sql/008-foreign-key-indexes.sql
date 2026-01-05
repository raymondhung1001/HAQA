BEGIN;

-- Indexes on foreign keys that might be missing
-- These improve join performance and cascade delete performance

-- User foreign keys
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON haqa_schema.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_functions_user_id ON haqa_schema.user_functions(user_id);

-- Test flow foreign keys
CREATE INDEX IF NOT EXISTS idx_test_flow_versions_test_flow_id ON haqa_schema.test_flow_versions(test_flow_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_nodes_test_flow_version_id ON haqa_schema.test_flow_nodes(test_flow_version_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_edges_source_node_id ON haqa_schema.test_flow_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_edges_target_node_id ON haqa_schema.test_flow_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_executions_test_flow_version_id ON haqa_schema.test_flow_executions(test_flow_version_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_executions_triggered_by_user_id ON haqa_schema.test_flow_executions(triggered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_node_execution_logs_execution_id ON haqa_schema.test_flow_node_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_test_flow_node_execution_logs_test_flow_node_id ON haqa_schema.test_flow_node_execution_logs(test_flow_node_id);

-- Partial indexes for active records (performance optimization)
CREATE INDEX IF NOT EXISTS idx_users_active_true ON haqa_schema.users(id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_test_flows_active_true ON haqa_schema.test_flows(id) WHERE is_active = TRUE;

-- Index for expired role/function lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_not_expired ON haqa_schema.user_roles(user_id, role_id) 
WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_user_functions_not_expired ON haqa_schema.user_functions(user_id, function_id) 
WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

COMMIT;

