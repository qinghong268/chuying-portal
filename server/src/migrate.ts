import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./connection";

function addColumnIfMissing(
  table: string,
  column: string,
  definition: string,
): void {
  const cols = getDb()
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateContentBlockDraftColumns(): void {
  addColumnIfMissing("content_blocks", "draft_title", "TEXT");
  addColumnIfMissing("content_blocks", "draft_body", "TEXT");
  getDb().exec(`
    UPDATE content_blocks SET draft_title = title WHERE draft_title IS NULL;
    UPDATE content_blocks SET draft_body = body WHERE draft_body IS NULL;
  `);
}

function migrateActivityDeadlineColumns(): void {
  addColumnIfMissing("activities", "point_apply_deadline", "INTEGER");
  const dayMs = 24 * 60 * 60 * 1000;
  getDb().exec(`
    UPDATE activities SET enroll_deadline = start_at;
    UPDATE activities
    SET point_apply_deadline = end_at + ${dayMs}
    WHERE point_apply_deadline IS NULL AND mode = 'online';
    UPDATE activities
    SET point_apply_deadline = end_at
    WHERE point_apply_deadline IS NULL AND mode = 'offline';
  `);
}

export function migrate(): void {
  const sql = readFileSync(join(__dirname, "migrate.sql"), "utf8");
  getDb().exec(sql);
  migrateContentBlockDraftColumns();
  migrateActivityDeadlineColumns();
}
