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
    WHERE point_apply_deadline IS NULL;
    -- Heal prior offline backfill that set deadline = end_at (zero-width window)
    UPDATE activities
    SET point_apply_deadline = end_at + ${dayMs}
    WHERE mode = 'offline' AND point_apply_deadline = end_at;
  `);
}

function migrateUserLastLoginColumn(): void {
  addColumnIfMissing("users", "last_login_at", "INTEGER");
}

function migrateContentBlockExtendedColumns(): void {
  addColumnIfMissing("content_blocks", "cover_url", "TEXT");
  addColumnIfMissing("content_blocks", "link_url", "TEXT");
  addColumnIfMissing("content_blocks", "link_label", "TEXT");
  addColumnIfMissing("content_blocks", "sort_order", "INTEGER NOT NULL DEFAULT 0");
}

function migrateActivityMediaColumns(): void {
  addColumnIfMissing("activities", "video_url", "TEXT");
  addColumnIfMissing("activities", "image_url", "TEXT");
}

function migrateCourseExtendedColumns(): void {
  addColumnIfMissing("courses", "video_url", "TEXT");
  addColumnIfMissing("courses", "cover_url", "TEXT");
  addColumnIfMissing("courses", "sort_order", "INTEGER NOT NULL DEFAULT 0");
}

function migratePointAppCourseId(): void {
  addColumnIfMissing("point_applications", "course_id", "INTEGER REFERENCES courses(id)");
}

function migrateContentBlockSummaryColumn(): void {
  addColumnIfMissing("content_blocks", "summary", "TEXT");
}

function migrateAiReviewsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS ai_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL UNIQUE REFERENCES point_applications(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      relevance INTEGER NOT NULL,
      suggestion TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      suggested_points INTEGER,
      draft_reject_reason TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}

function migrateKbDocumentsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS kb_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

function migrateWeeklyReportsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      enrollments_count INTEGER NOT NULL DEFAULT 0,
      courses_progressed INTEGER NOT NULL DEFAULT 0,
      points_earned INTEGER NOT NULL DEFAULT 0,
      applications_count INTEGER NOT NULL DEFAULT 0,
      ai_summary TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id, week_start)
    );
  `);
}

export function migrate(): void {
  const sql = readFileSync(join(__dirname, "migrate.sql"), "utf8");
  getDb().exec(sql);
  migrateContentBlockDraftColumns();
  migrateActivityDeadlineColumns();
  migrateUserLastLoginColumn();
  migrateContentBlockExtendedColumns();
  migrateActivityMediaColumns();
  migrateCourseExtendedColumns();
  migratePointAppCourseId();
  migrateContentBlockSummaryColumn();
  migrateAiReviewsTable();
  migrateKbDocumentsTable();
  migrateWeeklyReportsTable();
}
