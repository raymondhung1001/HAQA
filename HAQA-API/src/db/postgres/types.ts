import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Function = {
    id: Generated<number>;
    code: string;
    name: string;
    description: string | null;
    category: string | null;
    created_at: Generated<Timestamp | null>;
    updated_at: Generated<Timestamp | null>;
};
export type Role = {
    id: Generated<number>;
    name: string;
    description: string | null;
    is_system_role: Generated<boolean | null>;
    created_at: Generated<Timestamp | null>;
    updated_at: Generated<Timestamp | null>;
};
export type RoleFunction = {
    role_id: number;
    function_id: number;
};
export type User = {
    id: Generated<number>;
    username: string;
    email: string;
    password_hash: string;
    first_name: string | null;
    last_name: string | null;
    is_active: Generated<boolean | null>;
    last_login: Timestamp | null;
    created_at: Generated<Timestamp | null>;
    updated_at: Generated<Timestamp | null>;
};
export type UserFunction = {
    user_id: number;
    function_id: number;
    granted_at: Generated<Timestamp | null>;
    expires_at: Timestamp | null;
};
export type UserRole = {
    user_id: number;
    role_id: number;
    granted_at: Generated<Timestamp | null>;
    expires_at: Timestamp | null;
};
export type DB = {
    "haqa_schema.functions": Function;
    "haqa_schema.role_functions": RoleFunction;
    "haqa_schema.roles": Role;
    "haqa_schema.user_functions": UserFunction;
    "haqa_schema.user_roles": UserRole;
    "haqa_schema.users": User;
};
