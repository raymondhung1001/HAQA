BEGIN;

    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE OR REPLACE FUNCTION haqa_schema.hash_password(input_password TEXT)
    RETURNS TEXT AS $$
    BEGIN
        RETURN crypt(input_password, gen_salt('bf', 8));
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION haqa_schema.verify_password(input_password TEXT, password_hash TEXT)
    RETURNS BOOLEAN AS $$
    BEGIN
        RETURN password_hash = crypt(input_password, password_hash);
    END;
    $$ LANGUAGE plpgsql;

COMMIT;