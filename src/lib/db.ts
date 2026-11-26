import { SCHEMA_SQL, SEED_SQL, splitSql } from "@/db/schema";

/**
 * One tiny database interface, two drivers, identical SQL.
 *
 *   production / deployment  ->  Cloudflare D1 (SQLite)
 *   local development        ->  node:sqlite (a SQLite file on your machine)
 *
 * Every page and action in the app talks to `getDb()`, so the app code never
 * knows or cares which driver is running. That is what keeps the code portable.
 */

export type Row = Record<string, unknown>;
export type Param = string | number | null;

export interface Db {
  driver: "d1" | "sqlite";
  all<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: Param[]): Promise<T | null>;
  run(sql: string, params?: Param[]): Promise<void>;
}

type D1Prepared = {
  bind: (...params: Param[]) => {
    all: () => Promise<{ results?: unknown[] }>;
    first: () => Promise<unknown>;
    run: () => Promise<unknown>;
  };
};

type D1Binding = { prepare: (sql: string) => D1Prepared };

/** Cloudflare exposes bindings through a global context injected by the runtime. */
function findD1Binding(): D1Binding | null {
  const scope = globalThis as unknown as Record<string | symbol, unknown>;
  const context = scope[Symbol.for("__cloudflare-context__")] as
    | { env?: { DB?: D1Binding } }
    | undefined;
  const binding = context?.env?.DB;
  if (binding && typeof binding.prepare === "function") return binding;

  // Fallback for runtimes that place bindings on __env__ instead.
  const legacy = (scope.__env__ as { DB?: D1Binding } | undefined)?.DB;
  if (legacy && typeof legacy.prepare === "function") return legacy;

  return null;
}

function createD1Adapter(binding: D1Binding): Db {
  return {
    driver: "d1",
    async all<T>(sql: string, params: Param[] = []) {
      const result = await binding.prepare(sql).bind(...params).all();
      return (result.results ?? []) as T[];
    },
    async first<T>(sql: string, params: Param[] = []) {
      const result = await binding.prepare(sql).bind(...params).first();
      return (result ?? null) as T | null;
    },
    async run(sql: string, params: Param[] = []) {
      await binding.prepare(sql).bind(...params).run();
    },
  };
}

type SqliteHandle = {
  prepare: (sql: string) => {
    all: (...params: Param[]) => unknown[];
    get: (...params: Param[]) => unknown;
    run: (...params: Param[]) => unknown;
  };
  exec: (sql: string) => void;
};

function createSqliteAdapter(handle: SqliteHandle): Db {
  return {
    driver: "sqlite",
    async all<T>(sql: string, params: Param[] = []) {
      return handle.prepare(sql).all(...params) as T[];
    },
    async first<T>(sql: string, params: Param[] = []) {
      return (handle.prepare(sql).get(...params) ?? null) as T | null;
    },
    async run(sql: string, params: Param[] = []) {
      handle.prepare(sql).run(...params);
    },
  };
}

/**
 * Opens the local SQLite file. `process.getBuiltinModule` is used (instead of
 * `import "node:sqlite"`) so the bundler never tries to ship a Node module into
 * a Cloudflare Worker build.
 */
function openLocalSqlite(): SqliteHandle {
  const proc = process as unknown as {
    getBuiltinModule?: (name: string) => unknown;
  };
  const getBuiltin = proc.getBuiltinModule;
  if (!getBuiltin) {
    throw new Error(
      "Local database unavailable: this Node version has no process.getBuiltinModule. Use Node 22.5+ (recommended: Node 24).",
    );
  }

  const { DatabaseSync } = getBuiltin("node:sqlite") as {
    DatabaseSync: new (path: string) => SqliteHandle;
  };
  const fs = getBuiltin("node:fs") as {
    mkdirSync: (path: string, options: { recursive: boolean }) => void;
  };
  const path = getBuiltin("node:path") as { join: (...parts: string[]) => string };

  const directory = path.join(process.cwd(), ".data");
  fs.mkdirSync(directory, { recursive: true });

  const handle = new DatabaseSync(path.join(directory, "brandmitra.db"));
  handle.exec("PRAGMA journal_mode = WAL;");
  handle.exec("PRAGMA foreign_keys = ON;");
  return handle;
}

async function applySchema(db: Db): Promise<void> {
  for (const statement of splitSql(SCHEMA_SQL)) {
    await db.run(statement);
  }
  for (const statement of splitSql(SEED_SQL)) {
    await db.run(statement);
  }
}

/** Every table name the schema creates, read once from the SQL itself. */
const SCHEMA_TABLES = [...SCHEMA_SQL.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map(
  (match) => match[1],
);

/**
 * True when every table this build expects is already there.
 *
 * This matters more than it looks. Applying the schema is 76 statements — 35
 * tables, 26 indexes and 14 seed rows — and on D1 each one is its own round
 * trip. Running that on every cold isolate meant a storefront took 7 seconds to
 * open whenever the isolate had been recycled, because all 76 ran before the
 * first query the page actually needed. One cheap question to `sqlite_master`
 * replaces all of it, and an empty or partial database still gets the full
 * idempotent schema.
 */
async function schemaReady(db: Db): Promise<boolean> {
  if (SCHEMA_TABLES.length === 0) return false;
  const row = await db.first<{ n: number }>(
    `SELECT COUNT(*) AS n FROM sqlite_master
      WHERE type = 'table' AND name IN (${SCHEMA_TABLES.map(() => "?").join(", ")})`,
    SCHEMA_TABLES,
  );
  return Number(row?.n ?? 0) === SCHEMA_TABLES.length;
}

let cached: Promise<Db> | null = null;

async function connect(): Promise<Db> {
  const d1 = findD1Binding();
  const db: Db = d1 ? createD1Adapter(d1) : createSqliteAdapter(openLocalSqlite());
  // A database that is already set up must not pay for the whole schema again.
  if (!(await schemaReady(db))) await applySchema(db);
  return db;
}

/** Get the database connection for this runtime (cached after first call). */
export function getDb(): Promise<Db> {
  if (!cached) {
    cached = connect().catch((error) => {
      cached = null; // allow a later retry instead of caching the failure forever
      throw error;
    });
  }
  return cached;
}
