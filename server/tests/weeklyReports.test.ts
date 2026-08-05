import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

// Mock the DeepSeek API client so tests never hit the real endpoint.
vi.mock("../src/lib/deepseek", () => ({
  deepseekChat: vi.fn(),
}));

import { deepseekChat } from "../src/lib/deepseek";

const mockSummary = "本周学员学习积极主动，报名了新的活动并坚持完成课程学习，积分稳步增长，表现值得肯定，建议继续保持并尝试挑战更高目标。";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-weekly-reports";
  migrate();
  seed();
});

async function loginAs(
  app: ReturnType<typeof createApp>,
  role: "eagle" | "admin" | "super_admin",
) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/demo-login").send({ role });
  expect(res.status).toBe(200);
  return agent;
}

function eagleId(): number {
  const row = getDb()
    .prepare(`SELECT id FROM users WHERE role = 'eagle' LIMIT 1`)
    .get() as { id: number };
  return row.id;
}

function reportRows(): Array<Record<string, unknown>> {
  return getDb()
    .prepare(`SELECT * FROM weekly_reports ORDER BY id`)
    .all() as Array<Record<string, unknown>>;
}

/** Ended online activity inside the 7-day window, still enrollable (start_at in future). */
function createEndedOnlineActivity(targetPoints = 10): number {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const insert = getDb()
    .prepare(
      `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
       VALUES (?, ?, 'online', ?, ?, ?, ?, ?, 'published', 0, ?)`,
    )
    .run(
      "周报测试活动",
      "desc",
      now + hour,
      now - hour,
      now + hour,
      now + 2 * day,
      targetPoints,
      now,
    );
  return Number(insert.lastInsertRowid);
}

async function createCourseWithProgress(
  app: ReturnType<typeof createApp>,
): Promise<number> {
  const admin = await loginAs(app, "admin");
  const createRes = await admin.post("/api/admin/courses").send({
    title: "周报测试课程",
    description: "课程描述",
  });
  expect(createRes.status).toBe(201);
  const courseId = createRes.body.course.id as number;
  await admin.post(`/api/admin/courses/${courseId}/publish`);
  return courseId;
}

describe("admin weekly reports — generate", () => {
  it("super admin generates reports for all active eagles", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(mockSummary);

    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(10);
    await eagle.post(`/api/activities/${activityId}/enroll`);

    const superAdmin = await loginAs(app, "super_admin");
    const res = await superAdmin.post("/api/admin/weekly-reports/generate");
    expect(res.status).toBe(200);
    expect(res.body.generated).toBeGreaterThanOrEqual(1);
    expect(res.body.failed).toBe(0);
    expect(String(res.body.weekStart)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(deepseekChat).toHaveBeenCalled();

    const rows = reportRows();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].ai_summary).toBe(mockSummary);
    expect(rows[0].week_start).toBe(res.body.weekStart);
  });

  it("regenerating upserts instead of duplicating rows per user/week", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(mockSummary);

    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");

    const first = await superAdmin.post("/api/admin/weekly-reports/generate");
    expect(first.status).toBe(200);
    const firstCount = reportRows().length;

    const second = await superAdmin.post("/api/admin/weekly-reports/generate");
    expect(second.status).toBe(200);
    const secondRows = reportRows();

    const eagleRows = secondRows.filter((r) => r.user_id === eagleId());
    const forSameWeek = eagleRows.filter((r) => r.week_start === second.body.weekStart);
    expect(forSameWeek.length).toBe(1);

    // total rows grew only if a different week rolled over, never for the same week
    expect(reportRows().length).toBeLessThanOrEqual(firstCount + 1);
  });

  it("stores per-eagle weekly stats (enrollments, course progress, points, applications)", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(mockSummary);

    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const userId = eagleId();

    // Baseline from earlier tests sharing this in-memory DB (same 7-day window)
    const base = getDb()
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM enrollments WHERE user_id = ? AND status = 'enrolled' AND enrolled_at >= ?) AS enrollments,
           (SELECT COUNT(*) FROM course_progress WHERE user_id = ? AND updated_at >= ? AND percent > 0) AS courses,
           (SELECT COALESCE(SUM(delta), 0) FROM point_ledger WHERE user_id = ? AND created_at >= ? AND delta > 0) AS points,
           (SELECT COUNT(*) FROM point_applications WHERE user_id = ? AND created_at >= ?) AS applications`,
      )
      .get(
        userId,
        Date.now() - 7 * 24 * 60 * 60 * 1000,
        userId,
        Date.now() - 7 * 24 * 60 * 60 * 1000,
        userId,
        Date.now() - 7 * 24 * 60 * 60 * 1000,
        userId,
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ) as {
      enrollments: number;
      courses: number;
      points: number;
      applications: number;
    };

    // Enrollment within the window
    const activityId = createEndedOnlineActivity(10);
    await eagle.post(`/api/activities/${activityId}/enroll`);

    // Course with progress > 0 within the window
    const courseId = await createCourseWithProgress(app);
    await eagle.post(`/api/courses/${courseId}/enroll`);
    await eagle.put(`/api/courses/${courseId}/progress`).send({ percent: 60 });

    // Application + approved points within the window
    const reflectionOk = "心得".repeat(150);
    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(201);
    const applicationId = applyRes.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const approveRes = await admin
      .post(`/api/admin/point-applications/${applicationId}/approve`)
      .send({ pointsGranted: 8 });
    expect(approveRes.status).toBe(200);

    const superAdmin = await loginAs(app, "super_admin");
    const genRes = await superAdmin.post("/api/admin/weekly-reports/generate");
    expect(genRes.status).toBe(200);

    const row = getDb()
      .prepare(
        `SELECT * FROM weekly_reports
         WHERE user_id = ? AND week_start = ?`,
      )
      .get(userId, genRes.body.weekStart) as {
      enrollments_count: number;
      courses_progressed: number;
      points_earned: number;
      applications_count: number;
      ai_summary: string | null;
    };

    expect(row.enrollments_count).toBe(base.enrollments + 1);
    expect(row.courses_progressed).toBe(base.courses + 1);
    expect(row.points_earned).toBe(base.points + 8);
    expect(row.applications_count).toBe(base.applications + 1);
    expect(row.ai_summary).toBe(mockSummary);
  });

  it("forbids non-admin users", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const res = await eagle.post("/api/admin/weekly-reports/generate");
    expect(res.status).toBe(403);
  });
});

describe("admin weekly reports — list", () => {
  it("groups reports by week and includes user display names", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(mockSummary);

    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    await superAdmin.post("/api/admin/weekly-reports/generate");

    const res = await superAdmin.get("/api/admin/weekly-reports");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(res.body.weeks.length).toBeGreaterThanOrEqual(1);

    const week = res.body.weeks[0] as {
      weekStart: string;
      reports: Array<{
        id: number;
        userId: number;
        userDisplayName: string | null;
        enrollmentsCount: number;
        coursesProgressed: number;
        pointsEarned: number;
        applicationsCount: number;
        aiSummary: string | null;
      }>;
    };
    expect(typeof week.weekStart).toBe("string");
    expect(week.reports.length).toBeGreaterThanOrEqual(1);
    const report = week.reports[0];
    expect(report.userDisplayName).toBeTruthy();
    expect(typeof report.enrollmentsCount).toBe("number");
    expect(typeof report.aiSummary).toBe("string");
  });
});

describe("eagle weekly reports — my reports", () => {
  it("returns the current eagle's latest 4 weekly reports", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(mockSummary);

    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    await superAdmin.post("/api/admin/weekly-reports/generate");

    const eagle = await loginAs(app, "eagle");
    const res = await eagle.get("/api/me/weekly-reports");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.reports.length).toBeLessThanOrEqual(4);
    expect(res.body.reports.length).toBeGreaterThanOrEqual(1);

    const report = res.body.reports[0] as {
      weekStart: string;
      enrollmentsCount: number;
      pointsEarned: number;
      aiSummary: string | null;
    };
    expect(typeof report.weekStart).toBe("string");
    expect(typeof report.enrollmentsCount).toBe("number");
    expect(report.aiSummary).toBe(mockSummary);
  });
});
