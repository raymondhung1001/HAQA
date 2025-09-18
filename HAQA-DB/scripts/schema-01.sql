CREATE SCHEMA IF NOT EXISTS __DB_SCHEMA__;

-- Create sequences in the schema with tablespace
CREATE SEQUENCE IF NOT EXISTS __DB_SCHEMA__.users_id_seq;
CREATE SEQUENCE IF NOT EXISTS __DB_SCHEMA__.roles_id_seq;
CREATE SEQUENCE IF NOT EXISTS __DB_SCHEMA__.functions_id_seq;

-- Create tables in the schema with tablespace
CREATE TABLE IF NOT EXISTS __DB_SCHEMA__.users (
    id INTEGER PRIMARY KEY DEFAULT nextval('__DB_SCHEMA__.users_id_seq'),
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

ALTER SEQUENCE __DB_SCHEMA__.users_id_seq OWNED BY __DB_SCHEMA__.users.id;

-- Create indexes with tablespace
CREATE INDEX IF NOT EXISTS idx_users_email ON __DB_SCHEMA__.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON __DB_SCHEMA__.users(username);
CREATE INDEX IF NOT EXISTS idx_users_name ON __DB_SCHEMA__.users(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_users_active ON __DB_SCHEMA__.users(is_active);

CREATE TABLE IF NOT EXISTS __DB_SCHEMA__.roles (
    id INTEGER PRIMARY KEY DEFAULT nextval('__DB_SCHEMA__.roles_id_seq'),
    name VARCHAR(50) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT roles_name_unique UNIQUE (name)
);

ALTER SEQUENCE __DB_SCHEMA__.roles_id_seq OWNED BY __DB_SCHEMA__.roles.id;

CREATE INDEX IF NOT EXISTS idx_roles_name ON __DB_SCHEMA__.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_system ON __DB_SCHEMA__.roles(is_system_role);

CREATE TABLE IF NOT EXISTS __DB_SCHEMA__.functions (
    id INTEGER PRIMARY KEY DEFAULT nextval('__DB_SCHEMA__.functions_id_seq'),
    code VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT functions_code_unique UNIQUE (code),
    CONSTRAINT functions_name_unique UNIQUE (name)
);

ALTER SEQUENCE __DB_SCHEMA__.functions_id_seq OWNED BY __DB_SCHEMA__.functions.id;

CREATE INDEX IF NOT EXISTS idx_functions_code ON __DB_SCHEMA__.functions(code);
CREATE INDEX IF NOT EXISTS idx_functions_category ON __DB_SCHEMA__.functions(category);
CREATE INDEX IF NOT EXISTS idx_functions_category_code ON __DB_SCHEMA__.functions(category, code);

CREATE TABLE IF NOT EXISTS __DB_SCHEMA__.role_functions (
    role_id INTEGER NOT NULL,
    function_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, function_id),
    CONSTRAINT fk_role_functions_role FOREIGN KEY (role_id) REFERENCES __DB_SCHEMA__.roles(id),
    CONSTRAINT fk_role_functions_function FOREIGN KEY (function_id) REFERENCES __DB_SCHEMA__.functions(id)
);

CREATE INDEX IF NOT EXISTS idx_role_functions_role_id ON __DB_SCHEMA__.role_functions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_functions_function_id ON __DB_SCHEMA__.role_functions(function_id);

CREATE TABLE IF NOT EXISTS __DB_SCHEMA__.user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES __DB_SCHEMA__.users(id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES __DB_SCHEMA__.roles(id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_expires ON __DB_SCHEMA__.user_roles(user_id, role_id, expires_at);

CREATE TABLE IF NOT EXISTS __DB_SCHEMA__.user_functions (
    user_id INTEGER NOT NULL,
    function_id INTEGER NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, function_id),
    CONSTRAINT fk_user_functions_user FOREIGN KEY (user_id) REFERENCES __DB_SCHEMA__.users(id),
    CONSTRAINT fk_user_functions_function FOREIGN KEY (function_id) REFERENCES __DB_SCHEMA__.functions(id)
);

CREATE INDEX IF NOT EXISTS idx_user_functions_user_expires ON __DB_SCHEMA__.user_functions(user_id, function_id, expires_at);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create functions in the schema
CREATE OR REPLACE FUNCTION __DB_SCHEMA__.hash_password(input_password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(input_password, gen_salt('bf', 8));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION __DB_SCHEMA__.verify_password(input_password TEXT, password_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN password_hash = crypt(input_password, password_hash);
END;
$$ LANGUAGE plpgsql;