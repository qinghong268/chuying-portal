import { describe, it, expect, beforeAll } from "vitest";
import { migrate, seed, getDb } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  migrate();
  seed();
});

it("seeds three demo users with roles", () => {
  const rows = getDb()
    .prepare("SELECT role FROM users ORDER BY role")
    .all() as { role: string }[];
  expect(rows.map((r) => r.role).sort()).toEqual([
    "admin",
    "eagle",
    "super_admin",
  ]);
});

it("seeds demo data for an immediately demo-ready install", () => {
  const db = getDb();
  const eagleId = (
    db.prepare(`SELECT id FROM users WHERE email = 'eagle@demo'`).get() as {
      id: number;
    }
  ).id;

  // Two ended activities within the 24h apply window
  const now = Date.now();
  const ended = db
    .prepare(
      `SELECT COUNT(*) AS c FROM activities
       WHERE status = 'published' AND end_at < ? AND point_apply_deadline > ?`,
    )
    .get(now, now) as { c: number };
  expect(ended.c).toBe(2);

  // Eagle enrolled in both ended activities
  const enrollments = db
    .prepare(
      `SELECT COUNT(*) AS c FROM enrollments
       WHERE user_id = ? AND status = 'enrolled'`,
    )
    .get(eagleId) as { c: number };
  expect(enrollments.c).toBe(2);

  // One pending type1 reflection + one pending type2 application
  const pendingApps = db
    .prepare(
      `SELECT type FROM point_applications
       WHERE user_id = ? AND status = 'pending'`,
    )
    .all(eagleId) as { type: string }[];
  expect(pendingApps.map((a) => a.type).sort()).toEqual(["type1", "type2"]);

  // The pending type1 application carries an AI review for the dashboard badge
  const withAiReview = db
    .prepare(
      `SELECT COUNT(*) AS c FROM ai_reviews ar
       JOIN point_applications pa ON pa.id = ar.application_id
       WHERE pa.user_id = ? AND pa.status = 'pending'`,
    )
    .get(eagleId) as { c: number };
  expect(withAiReview.c).toBe(1);

  // One pending join application
  const pendingJoin = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM join_applications WHERE status = 'pending'`,
      )
      .get() as { c: number }
  ).c;
  expect(pendingJoin).toBe(1);
});
