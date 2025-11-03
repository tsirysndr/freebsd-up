import { DB_PATH } from "./constants.ts";
import { createDb, migrateToLatest } from "./db.ts";

export const db = createDb(DB_PATH);
await migrateToLatest(db);

export const ctx = {
  db,
};

export type Context = typeof ctx;
