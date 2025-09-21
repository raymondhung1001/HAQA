BEGIN;

    CREATE USER haqa_app WITH 
        PASSWORD '##APP_USER_PASSWORD##'
        NOSUPERUSER 
        NOCREATEDB 
        NOCREATEROLE 
        NOREPLICATION;

    CREATE SCHEMA IF NOT EXISTS haqa_schema;

    ALTER USER haqa_app SET search_path TO haqa_schema, public;
    ALTER USER postgres SET search_path TO haqa_schema, public;

COMMIT;