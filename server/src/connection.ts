import Database from "better-sqlite3";
import { join } from "node:path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const path = process.env.DATABASE_PATH ?? join(__dirname, "..", "data", "chuying.db");
    db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}
