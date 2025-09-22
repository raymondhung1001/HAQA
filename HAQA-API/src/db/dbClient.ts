import { Kysely, PostgresDialect } from 'kysely';
import type { DB } from './types';
import pg from 'pg';

export type DatabaseClient = Kysely<DB>;

export function setup(connectionString: string): DatabaseClient {
    
    const dbClient = new Kysely<DB>({
        dialect: new PostgresDialect({
            pool: new pg.Pool({
                connectionString,
                max: 50,
                connectionTimeoutMillis: 1000,
                idleTimeoutMillis: 0,
            }),
        }),
    });

    return dbClient;
}