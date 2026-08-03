/**
 * Task 12 smoke checklist — maps to plan table rows #1–#5 (API-automated).
 * Row #6 (visual: accent CTA, teal primary) is manual — see task-12 report.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

const reflectionOk = "心得".repeat(150);

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-smoke";
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

describe("smoke #1 — home CMS structure + featured", () => {
  it("home blocks include plan/company keys; featured endpoints respond", async () => {
    const app = createApp();
    const home = await request(app).get("/api/content/home");
    expect(home.status).toBe(200);
    const keys = home.body.blocks.map((b: { key: string }) => b.key);
    expect(keys).toContain("home_hero");
    expect(keys).toContain("home_plan_promo");
    expect(keys).toContain("home_company_promo");

    const acts = await request(app).get("/api/activities/featured?limit=3");
    expect(acts.status).toBe(200);
    expect(Array.isArray(acts.body.activities)).toBe(true);

    const courses = await request(app).get("/api/courses/featured?limit=3");
    expect(courses.status).toBe(200);
    expect(Array.isArray(courses.body.courses)).toBe(true);
  });
});

describe("smoke #2 — demo eagle login path", () => {
  it("demo-login eagle then GET /api/auth/me succeeds", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const me = await eagle.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe("eagle");
    expect(me.body.user.email).toBe("eagle@demo");
  });
});

describe("smoke #3–4 — enroll online, progress 99, apply, admin approve, ledger", () => {
  it("full type1 flow credits balance and ledger", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = (
      getDb()
        .prepare(
          `SELECT id FROM activities WHERE mode = 'online' AND status = 'published' LIMIT 1`,
        )
        .get() as { id: number }
    ).id;

    const enroll = await eagle.post(`/api/activities/${activityId}/enroll`);
    expect([201, 409]).toContain(enroll.status);
    await eagle
      .put(`/api/activities/${activityId}/progress`)
      .send({ percent: 99 });

    const enrollments = await eagle.get("/api/me/enrollments");
    expect(enrollments.status).toBe(200);
    const row = enrollments.body.enrollments.find(
      (e: { activityId: number }) => e.activityId === activityId,
    );
    expect(row?.canApplyType1).toBe(true);

    const apply = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(apply.status).toBe(201);
    const applicationId = apply.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const approve = await admin
      .post(`/api/admin/point-applications/${applicationId}/approve`)
      .send({ pointsGranted: 15 });
    expect(approve.status).toBe(200);

    const points = await eagle.get("/api/me/points");
    expect(points.body.balance).toBeGreaterThanOrEqual(15);
    expect(
      points.body.ledger.some(
        (e: { applicationId: number; delta: number }) =>
          e.applicationId === applicationId && e.delta === 15,
      ),
    ).toBe(true);
  });
});

describe("smoke #5 — super_admin cannot grant permission package", () => {
  it("PUT admin-grants rejects permission for normal admin", async () => {
    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    const adminId = (
      getDb()
        .prepare(`SELECT id FROM users WHERE email = 'admin@demo'`)
        .get() as { id: number }
    ).id;

    const res = await superAdmin
      .put(`/api/admin/admin-grants/${adminId}`)
      .send({ packages: ["content", "permission"] });
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/permission/i);
  });
});

describe("smoke — enrollments canApplyType1 requires published activity", () => {
  it("unpublished activity yields canApplyType1 false even at progress 99", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const admin = await loginAs(app, "admin");
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const insert = getDb()
      .prepare(
        `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
         VALUES (?, ?, 'online', ?, ?, ?, ?, 10, 'published', 0, ?)`,
      )
      .run("下架测试活动", "desc", now + day, now + 3 * day, now + day, now + 4 * day, now);
    const activityId = Number(insert.lastInsertRowid);

    await eagle.post(`/api/activities/${activityId}/enroll`);
    await eagle.put(`/api/activities/${activityId}/progress`).send({ percent: 99 });

    const unpublish = await admin.post(
      `/api/admin/activities/${activityId}/unpublish`,
    );
    expect(unpublish.status).toBe(200);

    const enrollments = await eagle.get("/api/me/enrollments");
    const row = enrollments.body.enrollments.find(
      (e: { activityId: number }) => e.activityId === activityId,
    );
    expect(row?.activityPublished).toBe(false);
    expect(row?.canApplyType1).toBe(false);
    expect(row?.applyBlockedReason).toMatch(/未发布/);
  });
});
