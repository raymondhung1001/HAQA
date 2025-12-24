BEGIN;

    CREATE TABLE IF NOT EXISTS haqa_schema.users (
        id INTEGER PRIMARY KEY DEFAULT nextval('haqa_schema.users_id_seq'),
        username VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_username_uk UNIQUE (username),
        CONSTRAINT users_email_uk UNIQUE (email)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.roles (
        id INTEGER PRIMARY KEY DEFAULT nextval('haqa_schema.roles_id_seq'),
        name VARCHAR(50) NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT roles_name_unique UNIQUE (name)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.functions (
        id INTEGER PRIMARY KEY DEFAULT nextval('haqa_schema.functions_id_seq'),
        code VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT functions_code_unique UNIQUE (code),
        CONSTRAINT functions_name_unique UNIQUE (name)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.role_functions (
        role_id INTEGER NOT NULL,
        function_id INTEGER NOT NULL,
        PRIMARY KEY (role_id, function_id),
        CONSTRAINT fk_role_functions_role FOREIGN KEY (role_id) REFERENCES haqa_schema.roles(id),
        CONSTRAINT fk_role_functions_function FOREIGN KEY (function_id) REFERENCES haqa_schema.functions(id)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.user_roles (
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES haqa_schema.users(id),
        CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES haqa_schema.roles(id)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.user_functions (
        user_id INTEGER NOT NULL,
        function_id INTEGER NOT NULL,
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        PRIMARY KEY (user_id, function_id),
        CONSTRAINT fk_user_functions_user FOREIGN KEY (user_id) REFERENCES haqa_schema.users(id),
        CONSTRAINT fk_user_functions_function FOREIGN KEY (function_id) REFERENCES haqa_schema.functions(id)
    );

    CREATE TYPE haqa_schema.workflow_node_type AS ENUM (
        'start',
        'end',
        'script',     -- Custom Python/JS code
        'api-call',   -- Standard HTTP Request
        'if-else',    -- Conditional Logic (Switch/Case)
        'for-loop',   -- Iteration
        'do-while',   -- Conditional Loop
        'wait'        -- Delay
    );

    CREATE TYPE haqa_schema.script_language AS ENUM (
        'javascript',
        'python',
        'bash'
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.workflows (
        id UUID NOT NULL,
        user_id INTEGER NOT NULL,
        name VARCHAR(150) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pk_workflows PRIMARY KEY (id, user_id),
        CONSTRAINT fk_workflows_user FOREIGN KEY (user_id) REFERENCES haqa_schema.users(id)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.workflow_versions (
        id UUID NOT NULL,
        workflow_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        ui_layout_json JSONB,
        CONSTRAINT pk_workflows_versions PRIMARY KEY (id, workflow_id),
        CONSTRAINT fk_versions_workflow FOREIGN KEY (workflow_id) REFERENCES haqa_schema.workflows(id)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.workflow_nodes (
        id UUID NOT NULL, 
        workflow_version_id UUID NOT NULL,
        node_type haqa_schema.workflow_node_type NOT NULL,
        label VARCHAR(100),
        
        script_language haqa_schema.script_language, 
        script_content TEXT,
        script_dependencies JSONB DEFAULT '{}'::jsonb,

        config JSONB DEFAULT '{}'::jsonb,
        
        position_x INTEGER,
        position_y INTEGER,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT pk_workflow_nodes PRIMARY KEY (id, workflow_version_id),
        CONSTRAINT fk_nodes_version FOREIGN KEY (workflow_version_id) REFERENCES haqa_schema.workflow_versions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.workflow_edges (
        id UUID NOT NULL, 
        workflow_version_id UUID NOT NULL,
        source_node_id UUID NOT NULL,
        target_node_id UUID NOT NULL,
        
        source_handle VARCHAR(50), 
        target_handle VARCHAR(50),
        
        label VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT pk_workflow_edges PRIMARY KEY (id, workflow_version_id),
        CONSTRAINT fk_edges_version FOREIGN KEY (workflow_version_id) REFERENCES haqa_schema.workflow_versions(id) ON DELETE CASCADE,
        CONSTRAINT fk_edges_source FOREIGN KEY (source_node_id) REFERENCES haqa_schema.workflow_nodes(id),
        CONSTRAINT fk_edges_target FOREIGN KEY (target_node_id) REFERENCES haqa_schema.workflow_nodes(id)
    );

    CREATE TABLE IF NOT EXISTS haqa_schema.workflow_executions (
        id UUID NOT NULL,
        workflow_version_id UUID NOT NULL,
        triggered_by_user_id INTEGER,
        status VARCHAR(20) DEFAULT 'PENDING',
        start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP WITH TIME ZONE,
        
        global_context JSONB DEFAULT '{}'::jsonb,
        
        CONSTRAINT pk_workflow_executions PRIMARY KEY (id, workflow_version_id),
        CONSTRAINT fk_execution_version FOREIGN KEY (workflow_version_id) REFERENCES haqa_schema.workflow_versions(id),
        CONSTRAINT fk_execution_user FOREIGN KEY (triggered_by_user_id) REFERENCES haqa_schema.users(id)
    )
    
    CREATE TABLE IF NOT EXISTS haqa_schema.node_execution_logs (
        id UUID NOT NULL,
        execution_id UUID NOT NULL,
        node_id UUID NOT NULL,
        status VARCHAR(20),
        
        console_output TEXT,
        error_output TEXT,
        evaluation_snapshot JSONB, 
        result_data JSONB,
        
        start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP WITH TIME ZONE,
        
        CONSTRAINT pk_node_execution_logs PRIMARY KEY (id, execution_id, node_id),
        CONSTRAINT fk_logs_execution FOREIGN KEY (execution_id) REFERENCES haqa_schema.workflow_executions(id),
        CONSTRAINT fk_logs_node FOREIGN KEY (node_id) REFERENCES haqa_schema.workflow_nodes(id)
    );

COMMIT;