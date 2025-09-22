import type { User } from "@/db/types";
import type { DatabaseClient } from "@/db/dbClient";
import { type Selectable } from "kysely";

export class UserDao {
    private dbClient: DatabaseClient;

    constructor(dbClient: DatabaseClient) {
        this.dbClient = dbClient;
    }

    async findAll(): Promise<Selectable<User>[]> {
        return this.dbClient
            .selectFrom('haqa_schema.users')
            .select([
                'id',
                'username',
                'email',
                'password_hash',
                'first_name',
                'last_name',
                'created_at',
                'updated_at',
                'last_login',
                'is_active'
            ])
            .execute();
    }
}