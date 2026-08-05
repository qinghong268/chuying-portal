import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const reflectionOk = "心得".repeat(150);

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-notifications";
  migrate();
  seed();
});

async function loginEagle(app: ReturnType<typeof createApp>) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/demo-login").send({ role: "eagle" });
  expect(res.status).toBe(200);
  return agent;
}

/** Enrollment only accepts activities with start_at in the future, so ended
 *  activities used for the reflection reminders need a future start_at. */
function insertActivity(opts: {
  title: string;
  startAt: number;
  endAt: number;
  applyDeadline: number | null;
}): number {
  const insert = getDb()
    .prepare(
      `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
       VALUES (?, ?, 'online', ?, ?, ?, ?, 10, 'published', 0, ?)`,
    )
    .run(
      opts.title,
      "desc",
      opts.startAt,
      opts.endAt,
      opts.startAt,
      opts.applyDeadline,
      Date.now(),
    );
  return Number(insert.lastInsertRowid);
}

describe("notifications", () => {
  it("returns 401 when not logged in", async () => {
    const app = createApp();
    const res = await request(app).get("/api/me/notifications");
    expect(res.status).toBe(401);
  });

  it("returns empty sections for an eagle without reminders", async () => {
    const app = createApp();
    const eagle = await loginEagle(app);
    const res = await eagle.get("/api/me/notifications");
    expect(res.status).toBe(200);
    expect(res.body.upcomingActivities).toEqual([]);
    expect(res.body.inProgressCourses).toEqual([]);
    expect(res.body.pendingReflections).toEqual([]);
    expect(res.body.closingWindows).toEqual([]);
  });

  it("lists upcoming activities, in-progress courses, pending reflections and closing windows", async () => {
    const app = createApp();
    const eagle = await loginEagle(app);
    const now = Date.now();

    // Upcoming: starts within 3 days, not yet ended.
    const upId = insertActivity({
      title: "即将开始的活动",
      startAt: now + 2 * day,
      endAt: now + 3 * day,
      applyDeadline: null,
    });
    // Ended with the apply window closing within 24h: pending reflection + closing window.
    const endedId = insertActivity({
      title: "已结束待提交心得",
      startAt: now + hour,
      endAt: now - hour,
      applyDeadline: now + 12 * hour,
    });
    // Ended long ago, no explicit deadline: pending reflection only.
    const oldId = insertActivity({
      title: "早已结束无截止",
      startAt: now + hour,
      endAt: now - 9 * day,
      applyDeadline: null,
    });

    await eagle.post(`/api/activities/${upId}/enroll`);
    await eagle.post(`/api/activities/${endedId}/enroll`);
    await eagle.post(`/api/activities/${oldId}/enroll`);

    const courseRow = getDb()
      .prepare(`SELECT id FROM courses WHERE status = 'published' LIMIT 1`)
      .get() as { id: number };
    await eagle.post(`/api/courses/${courseRow.id}/enroll`);

    const res = await eagle.get("/api/me/notifications");
    expect(res.status).toBe(200);

    expect(
      res.body.upcomingActivities.some((a: { id: number }) => a.id === upId),
    ).toBe(true);
    expect(
      res.body.inProgressCourses.some((c: { id: number }) => c.id === courseRow.id),
    ).toBe(true);
    expect(
      res.body.pendingReflections.some((r: { id: number }) => r.id === endedId),
    ).toBe(true);
    expect(
      res.body.pendingReflections.some((r: { id: number }) => r.id === oldId),
    ).toBe(true);
    expect(
      res.body.closingWindows.some((w: { id: number }) => w.id === endedId),
    ).toBe(true);
    expect(
      res.body.closingWindows.some((w: { id: number }) => w.id === oldId),
    ).toBe(false);
  });

  it("drops the reminder once a type1 application was submitted", async () => {
    const app = createApp();
    const eagle = await loginEagle(app);
    const now = Date.now();

    const endedId = insertActivity({
      title: "已结束已提交心得",
      startAt: now + hour,
      endAt: now - hour,
      applyDeadline: now + 12 * hour,
    });
    await eagle.post(`/api/activities/${endedId}/enroll`);

    const apply = await eagle.post("/api/me/point-applications").send({
      type: "type1",
      activityId: endedId,
      reflection: reflectionOk,
    });
    expect(apply.status).toBe(201);

    const res = await eagle.get("/api/me/notifications");
    expect(
      res.body.pendingReflections.some((r: { id: number }) => r.id === endedId),
    ).toBe(false);
    // Window itself still closing.
    expect(
      res.body.closingWindows.some((w: { id: number }) => w.id === endedId),
    ).toBe(true);
  });
});
