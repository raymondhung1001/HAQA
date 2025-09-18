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



COMMIT;