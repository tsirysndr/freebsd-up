import { Database as Sqlite } from "@db/sqlite";
import { DenoSqlite3Dialect } from "@soapbox/kysely-deno-sqlite";
import {
  Kysely,
  type Migration,
  type MigrationProvider,
  Migrator,
  sql,
} from "kysely";
import { CONFIG_DIR } from "./constants.ts";
import type { STATUS } from "./types.ts";

export const createDb = (location: string): Database => {
  Deno.mkdirSync(CONFIG_DIR, { recursive: true });
  return new Kysely<DatabaseSchema>({
    dialect: new DenoSqlite3Dialect({
      database: new Sqlite(location),
    }),
  });
};

export type DatabaseSchema = {
  virtual_machines: VirtualMachine;
};

export type VirtualMachine = {
  id: string;
  name: string;
  bridge?: string;
  macAddress: string;
  memory: string;
  cpus: number;
  cpu: string;
  diskSize: string;
  drivePath?: string;
  diskFormat: string;
  isoPath?: string;
  portForward?: string;
  version: string;
  status: STATUS;
  pid: number;
  createdAt?: string;
  updatedAt?: string;
};

const migrations: Record<string, Migration> = {};

const migrationProvider: MigrationProvider = {
  // deno-lint-ignore require-await
  async getMigrations() {
    return migrations;
  },
};

migrations["001"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("virtual_machines")
      .addColumn("id", "varchar", (col) => col.primaryKey())
      .addColumn("name", "varchar", (col) => col.notNull().unique())
      .addColumn("bridge", "varchar")
      .addColumn("macAddress", "varchar", (col) => col.notNull().unique())
      .addColumn("memory", "varchar", (col) => col.notNull())
      .addColumn("cpus", "integer", (col) => col.notNull())
      .addColumn("cpu", "varchar", (col) => col.notNull())
      .addColumn("diskSize", "varchar", (col) => col.notNull())
      .addColumn("drivePath", "varchar")
      .addColumn("version", "varchar", (col) => col.notNull())
      .addColumn("diskFormat", "varchar")
      .addColumn("isoPath", "varchar")
      .addColumn("status", "varchar", (col) => col.notNull())
      .addColumn("pid", "integer")
      .addColumn(
        "createdAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .addColumn(
        "updatedAt",
        "varchar",
        (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("virtual_machines").execute();
  },
};

migrations["002"] = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("virtual_machines")
      .addColumn("portForward", "varchar")
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .alterTable("virtual_machines")
      .dropColumn("portForward")
      .execute();
  },
};

export const migrateToLatest = async (db: Database): Promise<void> => {
  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
};

export type Database = Kysely<DatabaseSchema>;
