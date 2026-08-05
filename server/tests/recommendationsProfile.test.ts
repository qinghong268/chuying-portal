import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

// Mock the DeepSeek API client so tests never hit the real endpoint.
vi.mock("../src/lib/deepseek", () => ({
  deepseekChat: vi.fn(),
}));

import { deepseekChat } from "../src/lib/deepseek";

const reflectionOk = "心得".repeat(150); // 300 chars

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-recommendations";
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

/** Published online activity that starts in the future, so it is recommendable
 *  and still enrollable. */
function createPublishedActivity(title: string, targetPoints = 10): number {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const insert = getDb()
    .prepare(
      `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
       VALUES (?, ?, 'online', ?, ?, ?, ?, ?, 'published', 0, ?)`,
    )
    .run(title, "desc", now + day, now + 2 * day, now + day, now + 3 * day, targetPoints, now);
  return Number(insert.lastInsertRowid);
}

/** Ended online activity inside the apply window, still enrollable (start_at in future). */
function createEndedOnlineActivity(targetPoints = 15): number {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const insert = getDb()
    .prepare(
      `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
       VALUES (?, ?, 'online', ?, ?, ?, ?, ?, 'published', 0, ?)`,
    )
    .run(
      "画像测试活动",
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

async function createPublishedCourse(
  app: ReturnType<typeof createApp>,
  title: string,
): Promise<number> {
  const admin = await loginAs(app, "admin");
  const createRes = await admin.post("/api/admin/courses").send({
    title,
    description: "课程描述",
  });
  expect(createRes.status).toBe(201);
  const courseId = createRes.body.course.id as number;
  await admin.post(`/api/admin/courses/${courseId}/publish`);
  return courseId;
}

describe("GET /api/me/recommendations", () => {
  it("returns AI recommendations built from enrolled + available items", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createPublishedActivity("推荐测试活动");
    const courseId = await createPublishedCourse(app, "推荐测试课程");

    vi.mocked(deepseekChat).mockResolvedValueOnce(
      JSON.stringify([
        { id: activityId, type: "activity", reason: "推荐参加线下分享活动" },
        { id: courseId, type: "course", reason: "推荐学习进阶课程" },
        { id: activityId, type: "activity", reason: "继续挑战更高目标" },
      ]),
    );

    const res = await eagle.get("/api/me/recommendations");
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(3);
    const rec = res.body.recommendations[0] as {
      id: number;
      type: string;
      reason: string;
    };
    expect(rec.id).toBe(activityId);
    expect(rec.type).toBe("activity");
    expect(typeof rec.reason).toBe("string");

    // The AI prompt must include the enrolled + available context.
    const call = vi.mocked(deepseekChat).mock.calls[0];
    const userMessage = call[0].find((m: { role: string }) => m.role === "user");
    expect(userMessage?.content).toContain("已报名的活动");
    expect(userMessage?.content).toContain("可推荐的活动");
    expect(userMessage?.content).toContain(`#${activityId} 推荐测试活动`);
    expect(userMessage?.content).toContain("可推荐的课程");
    expect(userMessage?.content).toContain(`#${courseId} 推荐测试课程`);
  });

  it("falls back to rule-based recommendations when the AI call fails", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    createPublishedActivity("回退测试活动A");
    createPublishedActivity("回退测试活动B");
    await createPublishedCourse(app, "回退测试课程");

    vi.mocked(deepseekChat).mockRejectedValueOnce(new Error("network down"));

    const res = await eagle.get("/api/me/recommendations");
    expect(res.status).toBe(200);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(3);
    const types = res.body.recommendations.map(
      (r: { type: string }) => r.type,
    ) as string[];
    expect(types).toContain("activity");
    expect(types).toContain("course");
    // Fallback picks the first available items: 2 activities + 1 course.
    const activityRecs = res.body.recommendations.filter(
      (r: { type: string }) => r.type === "activity",
    ) as Array<{ reason: string }>;
    expect(activityRecs[0].reason).toContain("新活动");
    const courseRec = res.body.recommendations.find(
      (r: { type: string }) => r.type === "course",
    ) as { id: number; reason: string } | undefined;
    expect(courseRec?.reason).toContain("推荐课程");
  });

  it("requires eagle role", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");
    const anon = request.agent(app);

    const anonRes = await anon.get("/api/me/recommendations");
    expect(anonRes.status).toBe(401);

    const adminRes = await admin.get("/api/me/recommendations");
    expect(adminRes.status).toBe(403);
  });
});

describe("GET /api/me/profile", () => {
  it("aggregates radar dimensions, milestones, and stats", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(15);

    // Seed data already contains demo enrollments/applications, so assert deltas.
    const eagleId = (
      getDb().prepare(`SELECT id FROM users WHERE role = 'eagle' LIMIT 1`).get() as {
        id: number;
      }
    ).id;
    const countEnrollments = () =>
      (
        getDb()
          .prepare(
            `SELECT COUNT(*) AS c FROM enrollments WHERE user_id = ? AND status = 'enrolled'`,
          )
          .get(eagleId) as { c: number }
      ).c;
    const countApps = () =>
      (
        getDb()
          .prepare(`SELECT COUNT(*) AS c FROM point_applications WHERE user_id = ?`)
          .get(eagleId) as { c: number }
      ).c;
    const enrollmentsBefore = countEnrollments();
    const appsBefore = countApps();

    // Enroll + type1 application, then admin approves 120 points.
    await eagle.post(`/api/activities/${activityId}/enroll`);
    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(201);
    const activityAppId = applyRes.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const approve1 = await admin
      .post(`/api/admin/point-applications/${activityAppId}/approve`)
      .send({ pointsGranted: 120 });
    expect(approve1.status).toBe(200);

    // Type2 application on the contest_award template, approved with 30 points.
    const type2Res = await eagle.post("/api/me/point-applications").send({
      type: "type2",
      templateCode: "contest_award",
      title: "编程竞赛获奖",
      reason: "在地区编程竞赛中获得奖项",
    });
    expect(type2Res.status).toBe(201);
    const type2AppId = type2Res.body.application.id as number;
    const approve2 = await admin
      .post(`/api/admin/point-applications/${type2AppId}/approve`)
      .send({ pointsGranted: 30 });
    expect(approve2.status).toBe(200);

    const res = await eagle.get("/api/me/profile");
    expect(res.status).toBe(200);

    // Radar: one dimension per enabled template, with earned points folded in.
    expect(res.body.radar.length).toBeGreaterThan(0);
    const contest = res.body.radar.find(
      (d: { label: string }) => d.label === "比赛获奖",
    ) as { label: string; value: number; earned: number } | undefined;
    expect(contest).toBeDefined();
    expect(contest!.earned).toBe(30);
    expect(contest!.value).toBe(Math.min(100, Math.round((30 / 50) * 100)));

    // Stats: seed data is present too, so assert the deltas from this test.
    expect(res.body.stats.totalPoints).toBe(150);
    expect(res.body.stats.enrollmentCount).toBe(enrollmentsBefore + 1);
    expect(res.body.stats.appCount).toBe(appsBefore + 2);
    expect(res.body.stats.courseCount).toBe(0);
    expect(res.body.stats.joinDate).toBeGreaterThan(0);

    // Milestones: join + first enrollment + first application + first points + crossing 100.
    const events = res.body.milestones.map(
      (m: { event: string }) => m.event,
    ) as string[];
    expect(events).toContain("加入雏英计划");
    expect(events).toContain("首次报名活动");
    expect(events).toContain("首次提交积分申请");
    expect(events).toContain("首次获得积分");
    expect(events).toContain("积分突破 100");
    const dates = res.body.milestones.map(
      (m: { date: number }) => m.date,
    ) as number[];
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  it("requires eagle role", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");

    const adminRes = await admin.get("/api/me/profile");
    expect(adminRes.status).toBe(403);
  });
});
