BEGIN;

    CREATE INDEX IF NOT EXISTS idx_users_email ON haqa_schema.users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON haqa_schema.users(username);
    CREATE INDEX IF NOT EXISTS idx_users_name ON haqa_schema.users(first_name, last_name);
    CREATE INDEX IF NOT EXISTS idx_users_active ON haqa_schema.users(is_active);

    CREATE INDEX IF NOT EXISTS idx_roles_name ON haqa_schema.roles(name);
    CREATE INDEX IF NOT EXISTS idx_roles_system ON haqa_schema.roles(is_system_role);

    CREATE INDEX IF NOT EXISTS idx_functions_code ON haqa_schema.functions(code);
    CREATE INDEX IF NOT EXISTS idx_functions_category ON haqa_schema.functions(category);
    CREATE INDEX IF NOT EXISTS idx_functions_category_code ON haqa_schema.functions(category, code);

    CREATE INDEX IF NOT EXISTS idx_role_functions_role_id ON haqa_schema.role_functions(role_id);
    CREATE INDEX IF NOT EXISTS idx_role_functions_function_id ON haqa_schema.role_functions(function_id);

    CREATE INDEX IF NOT EXISTS idx_user_roles_user_expires ON haqa_schema.user_roles(user_id, role_id, expires_at);

    CREATE INDEX IF NOT EXISTS idx_user_functions_user_expires ON haqa_schema.user_functions(user_id, function_id, expires_at);

    CREATE INDEX IF NOT EXISTS idx_workflows_user_id_is_active ON haqa_schema.workflows(user_id, is_active);

    CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id_version_number ON haqa_schema.workflow_versions(workflow_id, version_number DESC);

    CREATE INDEX IF NOT EXISTS idx_nodes_version_type ON haqa_schema.workflow_nodes(workflow_version_id, node_type);

    CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow_version_id ON haqa_schema.workflow_edges(workflow_version_id);

    CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_version_id_start_time ON haqa_schema.workflow_executions(workflow_version_id, start_time DESC);

    CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON haqa_schema.workflow_executions(status) ON haqa_schema.workflow_executions(status);

    CREATE INDEX IF NOT EXISTS idx_node_execution_logs_execution_id_node_id ON haqa_schema.node_execution_logs(execution_id, node_id);

COMMIT;