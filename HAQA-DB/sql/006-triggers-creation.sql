BEGIN;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION haqa_schema.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for all tables with updated_at column
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON haqa_schema.users
    FOR EACH ROW
    EXECUTE FUNCTION haqa_schema.update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON haqa_schema.roles
    FOR EACH ROW
    EXECUTE FUNCTION haqa_schema.update_updated_at_column();

CREATE TRIGGER update_functions_updated_at
    BEFORE UPDATE ON haqa_schema.functions
    FOR EACH ROW
    EXECUTE FUNCTION haqa_schema.update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON haqa_schema.workflows
    FOR EACH ROW
    EXECUTE FUNCTION haqa_schema.update_updated_at_column();

COMMIT;

