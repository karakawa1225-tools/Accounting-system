import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

let dbInstance: Database | null = null;
let libsqlClient: Client | null = null;

/** マイグレーション未実行環境向けの生 SQL 用（`account_divisions` ブートストラップなど） */
export function getLibsqlClient(): Client {
  if (libsqlClient) return libsqlClient;
  getDb();
  if (!libsqlClient) throw new Error("LibSQL client not initialized");
  return libsqlClient;
}

export function getDb(): Database {
  if (dbInstance) return dbInstance;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  libsqlClient = client;
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}
