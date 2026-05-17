import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const DB_AVAILABLE = !!process.env.DATABASE_URL;

// Only connect when DATABASE_URL is present — server boots fine without it
export const pool: pg.Pool | null = DB_AVAILABLE
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export const db: DrizzleDb = (
  DB_AVAILABLE && pool ? drizzle(pool, { schema }) : null
) as DrizzleDb;

export * from "./schema";
