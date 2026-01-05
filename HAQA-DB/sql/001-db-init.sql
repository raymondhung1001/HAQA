BEGIN;

    CREATE USER haqa_app WITH 
        PASSWORD '##APP_USER_PASSWORD##'
        NOSUPERUSER 
        NOCREATEDB 
        NOCREATEROLE 
        NOREPLICATION;

    CREATE SCHEMA IF NOT EXISTS haqa_schema;

    -- Grant USAGE on schema immediately after creation
    GRANT USAGE ON SCHEMA haqa_schema TO haqa_app;

    ALTER USER haqa_app SET search_path TO haqa_schema, public;
    ALTER USER postgres SET search_path TO haqa_schema, public;

COMMIT;