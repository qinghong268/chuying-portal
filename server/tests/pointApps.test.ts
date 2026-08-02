import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

const reflectionOk = "心得".repeat(150); // 300 chars
const reflectionShort = "心得".repeat(149); // 298 chars
const reflectionLong = "心得".repeat(201); // 402 chars

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

function onlineActivityId(): number {
  const row = getDb()
    .prepare(`SELECT id FROM activities WHERE mode = 'online' AND status = 'published' LIMIT 1`)
    .get() as { id: number };
  return row.id;
}

describe("point applications — online progress gate", () => {
  it("progress 99: apply then admin approve credits balance", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = onlineActivityId();

    const enrollRes = await eagle.post(`/api/activities/${activityId}/enroll`);
    expect([201, 409]).toContain(enrollRes.status);

    const progressRes = await eagle
      .put(`/api/activities/${activityId}/progress`)
      .send({ percent: 99 });
    expect(progressRes.status).toBe(200);

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

  it("progress 98: type1 apply rejected", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    // Fresh online activity so progress can be 98 without clobbering the 99 case ledger story
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const insert = getDb()
      .prepare(
        `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, target_points, status, featured, created_at)
         VALUES (?, ?, 'online', ?, ?, ?, 10, 'published', 0, ?)`,
      )
      .run("进度98活动", "desc", now + day, now + 3 * day, now + day, now);
    const activityId = Number(insert.lastInsertRowid);

    await eagle.post(`/api/activities/${activityId}/enroll`);
    await eagle.put(`/api/activities/${activityId}/progress`).send({ percent: 98 });

    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId,
      reflection: reflectionOk,
    });
    expect(applyRes.status).toBe(422);
  });
});

describe("point applications — reflection length", () => {
  it("rejects reflection shorter than 300 or longer than 400", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const activityId = onlineActivityId();

    await eagle.post(`/api/activities/${activityId}/enroll`);
    await eagle.put(`/api/activities/${activityId}/progress`).send({ percent: 99 });

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
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const insert = getDb()
      .prepare(
        `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, target_points, status, featured, created_at)
         VALUES (?, ?, 'online', ?, ?, ?, 10, 'published', 0, ?)`,
      )
      .run("双审活动", "desc", now + day, now + 3 * day, now + day, now);
    const activityId = Number(insert.lastInsertRowid);

    await eagle.post(`/api/activities/${activityId}/enroll`);
    await eagle.put(`/api/activities/${activityId}/progress`).send({ percent: 99 });

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
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const insert = getDb()
      .prepare(
        `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, target_points, status, featured, created_at)
         VALUES (?, ?, 'online', ?, ?, ?, 10, 'published', 0, ?)`,
      )
      .run("驳回再提活动", "desc", now + day, now + 3 * day, now + day, now);
    const activityId = Number(insert.lastInsertRowid);

    await eagle.post(`/api/activities/${activityId}/enroll`);
    await eagle.put(`/api/activities/${activityId}/progress`).send({ percent: 99 });

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
