import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const DEFAULT_DB_PATH = 'hedgelens.db';

export type DbConnection = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: DatabaseType;
};

/**
 * Create a database connection with WAL mode and foreign keys enabled.
 * Returns both the drizzle instance and the raw better-sqlite3 handle.
 */
export function getDb(dbPath: string = DEFAULT_DB_PATH): DbConnection {
  const sqlite = new Database(dbPath);

  // Enable WAL mode for concurrent read performance
  sqlite.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

// Default singleton connection for the main application database
const defaultConnection: DbConnection = getDb();

/** Drizzle ORM instance for the default hedgelens.db */
export const db: BetterSQLite3Database<typeof schema> = defaultConnection.db;

/** Raw better-sqlite3 handle for direct access if needed */
export const sqlite: DatabaseType = defaultConnection.sqlite;
