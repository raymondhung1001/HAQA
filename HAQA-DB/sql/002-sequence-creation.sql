BEGIN;

    CREATE SEQUENCE IF NOT EXISTS haqa_schema.users_id_seq;
    CREATE SEQUENCE IF NOT EXISTS haqa_schema.roles_id_seq;
    CREATE SEQUENCE IF NOT EXISTS haqa_schema.functions_id_seq;

COMMIT;