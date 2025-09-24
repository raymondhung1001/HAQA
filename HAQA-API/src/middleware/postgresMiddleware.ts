import { setup } from "@/db/postgres";
import type { Context, Next } from "hono";

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
}

const dbClient = setup(process.env.DATABASE_URL);

export async function dbClientMiddleWare(c: Context, next: Next) {
    c.set("dbClient", dbClient);
    await next();
}