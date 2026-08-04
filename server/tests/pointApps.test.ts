import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

const reflectionOk = "心得".repeat(150); // 300 chars
const reflectionShort = "心得".repeat(149); // 298 chars
const reflectionLong = "心得".repeat(501); // 1002 chars

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-point-apps";
  migrate();
  seed();
});

async function loginAs(app: ReturnType<typeof createApp>, role: "eagle" | "admin" | "super_admin") {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/demo-login").send({ role });
  expect(res.status).toBe(200);
  return agent;
}

/** Insert an online activity that has already ended (within the 24h apply window)
 *  but whose start_at is still in the future so the enroll endpoint accepts it. */
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
      "已结束线上活动",
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

describe("point applications — activity type1 (no progress check, ended + 24h window)", () => {
  it("ended activity: apply then admin approve credits balance", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(15);

    const enrollRes = await eagle.post(`/api/activities/${activityId}/enroll`);
    expect([201, 409]).toContain(enrollRes.status);

    // Online activity without any watch progress is still eligible: no progress check.
    const enrollments = await eagle.get("/api/me/enrollments");
    const row = enrollments.body.enrollments.find(
      (e: { activityId: number }) => e.activityId === activityId,
    );
    expect(row?.canApplyType1).toBe(true);

    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
      points: 9999, // applicant must not control granted/requested points
    });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.application.status).toBe("pending");
    expect(applyRes.body.application.pointsRequested).toBeDefined();
    expect(applyRes.body.application.pointsRequested).not.toBe(9999);
    expect(applyRes.body.application.pointsRequested).toBe(15);
    const applicationId = applyRes.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const approveRes = await admin
      .post(`/api/admin/point-applications/${applicationId}/approve`)
      .send({ pointsGranted: 12 });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.application.status).toBe("approved");
    expect(approveRes.body.application.pointsGranted).toBe(12);

    const pointsRes = await eagle.get("/api/me/points");
    expect(pointsRes.status).toBe(200);
    expect(pointsRes.body.balance).toBeGreaterThanOrEqual(12);
    expect(pointsRes.body.ledger.some((e: { applicationId: number; delta: number }) =>
      e.applicationId === applicationId && e.delta === 12,
    )).toBe(true);
  });

  it("activity not ended: type1 apply rejected", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const insert = getDb()
      .prepare(
        `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
         VALUES (?, ?, 'online', ?, ?, ?, ?, 10, 'published', 0, ?)`,
      )
      .run("未结束活动", "desc", now + day, now + 3 * day, now + day, now + 4 * day, now);
    const activityId = Number(insert.lastInsertRowid);

    await eagle.post(`/api/activities/${activityId}/enroll`);

    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(422);
  });

  it("course-like online activity with progress 98 is still applicable once ended", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(10);

    await eagle.post(`/api/activities/${activityId}/enroll`);
    await eagle.put(`/api/activities/${activityId}/progress`).send({ percent: 98 });

    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(201);
  });
});

describe("point applications — course type1 (progress ≥ 99)", () => {
  it("course progress 99: apply then admin approve credits balance", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");
    const eagle = await loginAs(app, "eagle");

    const createRes = await admin.post("/api/admin/courses").send({
      title: "测试课程",
      description: "课程描述",
      videoUrl: "https://example.com/video.mp4",
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.course.status).toBe("draft");
    const courseId = createRes.body.course.id as number;

    const pubRes = await admin.post(`/api/admin/courses/${courseId}/publish`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.course.status).toBe("published");

    const enrollRes = await eagle.post(`/api/courses/${courseId}/enroll`);
    expect(enrollRes.status).toBe(201);

    // Not enough progress yet: rejected
    const earlyApply = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      courseId,
      reflection: reflectionOk,
    });
    expect(earlyApply.status).toBe(422);

    // Still below threshold at 98
    await eagle.put(`/api/courses/${courseId}/progress`).send({ percent: 98 });
    const belowApply = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      courseId,
      reflection: reflectionOk,
    });
    expect(belowApply.status).toBe(422);

    // At 99 the apply succeeds; courses have no target points so requested is null
    await eagle.put(`/api/courses/${courseId}/progress`).send({ percent: 99 });
    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      courseId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(201);
    expect(applyRes.body.application.courseId).toBe(courseId);
    expect(applyRes.body.application.activityId).toBeNull();
    expect(applyRes.body.application.pointsRequested).toBeNull();
    const applicationId = applyRes.body.application.id as number;

    // A second application for the same course is blocked
    const duplicate = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      courseId,
      reflection: reflectionOk,
    });
    expect(duplicate.status).toBe(409);

    const approveRes = await admin
      .post(`/api/admin/point-applications/${applicationId}/approve`)
      .send({ pointsGranted: 20 });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.application.status).toBe("approved");
    expect(approveRes.body.application.pointsGranted).toBe(20);

    const pointsRes = await eagle.get("/api/me/points");
    expect(pointsRes.status).toBe(200);
    expect(pointsRes.body.ledger.some((e: { applicationId: number; delta: number }) =>
      e.applicationId === applicationId && e.delta === 20,
    )).toBe(true);
  });

  it("course apply requires enrollment", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");
    const eagle = await loginAs(app, "eagle");

    const createRes = await admin.post("/api/admin/courses").send({
      title: "未报名课程",
      description: "desc",
    });
    const courseId = createRes.body.course.id as number;
    await admin.post(`/api/admin/courses/${courseId}/publish`);

    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      courseId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(422);
  });
});

describe("point applications — reflection length", () => {
  it("rejects reflection shorter than 300 or longer than 1000", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(10);

    await eagle.post(`/api/activities/${activityId}/enroll`);

    const shortRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionShort,
    });
    expect(shortRes.status).toBe(400);

    const longRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionLong,
    });
    expect(longRes.status).toBe(400);
  });
});

describe("point applications — double approve", () => {
  it("second approve returns 409 and does not double-credit ledger", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(10);

    await eagle.post(`/api/activities/${activityId}/enroll`);

    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(201);
    const applicationId = applyRes.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const firstApprove = await admin
      .post(`/api/admin/point-applications/${applicationId}/approve`)
      .send({ pointsGranted: 10 });
    expect(firstApprove.status).toBe(200);

    const secondApprove = await admin
      .post(`/api/admin/point-applications/${applicationId}/approve`)
      .send({ pointsGranted: 10 });
    expect(secondApprove.status).toBe(409);

    const ledgerCount = (
      getDb()
        .prepare(`SELECT COUNT(*) AS c FROM point_ledger WHERE application_id = ?`)
        .get(applicationId) as { c: number }
    ).c;
    expect(ledgerCount).toBe(1);
  });
});

describe("point applications — reject then re-submit", () => {
  it("reject requires reason; re-submit creates a new application id", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = createEndedOnlineActivity(10);

    await eagle.post(`/api/activities/${activityId}/enroll`);

    const first = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(first.status).toBe(201);
    const firstId = first.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const rejectNoReason = await admin
      .post(`/api/admin/point-applications/${firstId}/reject`)
      .send({ reason: "" });
    expect(rejectNoReason.status).toBe(400);

    const rejectRes = await admin
      .post(`/api/admin/point-applications/${firstId}/reject`)
      .send({ reason: "内容不符合要求，请补充具体收获" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.application.status).toBe("rejected");

    const secondReflection = ("再提" + "心得".repeat(149)).slice(0, 300);
    const second = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: secondReflection,
    });
    expect(second.status).toBe(201);
    expect(second.body.application.id).not.toBe(firstId);
    expect(second.body.application.status).toBe("pending");

    const original = await eagle.get(`/api/me/point-applications/${firstId}`);
    expect(original.status).toBe(200);
    expect(original.body.application.status).toBe("rejected");
  });
});
