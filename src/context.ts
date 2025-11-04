import { DB_PATH } from "./constants.ts";
import { createDb, type Database, migrateToLatest } from "./db.ts";

export const db: Database = createDb(DB_PATH);
await migrateToLatest(db);

export const ctx = {
  db,
};

export type Context = typeof ctx;
