import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

const DAY_MS = 24 * 60 * 60 * 1000;

// Date label in the same local-time "M/D" format the endpoint uses
function dateLabel(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface SeededIds {
  pendingJoinIds: number[];
  pendingPointAppIds: number[];
  approvedPointAppId: number;
  activeActivityId: number;
}

let seeded: SeededIds;

function seedDashboardData(): SeededIds {
  const db = getDb();
  const now = Date.now();

  // Extra eagles so enrollments can reference distinct users
  const insertUser = db.prepare(
    `INSERT INTO users (email, password_hash, role, display_name, status, created_at)
     VALUES (?, 'x', 'eagle', ?, 'active', ?)`,
  );
  insertUser.run(`eagle-2-${now}@demo`, "雏英二号", now);
  insertUser.run(`eagle-3-${now}@demo`, "雏英三号", now);
  const eagle1Id = (
    db.prepare(`SELECT id FROM users WHERE email = 'eagle@demo'`).get() as {
      id: number;
    }
  ).id;
  const eagle2Id = (
    db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(`eagle-2-${now}@demo`) as { id: number }
  ).id;
  const eagle3Id = (
    db
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .get(`eagle-3-${now}@demo`) as { id: number }
  ).id;

  // Join applications: 2 pending, 1 approved, 1 rejected
  const insertJoin = db.prepare(
    `INSERT INTO join_applications (name, contact, message, status, created_at)
     VALUES (?, ?, '想加入', ?, ?)`,
  );
  const pendingJoinIds = [
    Number(insertJoin.run("待审甲", "a@example.com", "pending", now - 1 * DAY_MS).lastInsertRowid),
    Number(insertJoin.run("待审乙", "b@example.com", "pending", now - 2 * DAY_MS).lastInsertRowid),
  ];
  insertJoin.run("已通过", "c@example.com", "approved", now - 3 * DAY_MS);
  insertJoin.run("已驳回", "d@example.com", "rejected", now - 4 * DAY_MS);

  // Point applications: 2 pending, 1 approved
  const insertPointApp = db.prepare(
    `INSERT INTO point_applications (user_id, type, payload, status, points_requested, created_at)
     VALUES (?, 'type1', '{}', ?, ?, ?)`,
  );
  const pendingPointAppIds = [
    Number(insertPointApp.run(eagle1Id, "pending", 50, now - 1 * DAY_MS).lastInsertRowid),
    Number(insertPointApp.run(eagle2Id, "pending", 30, now - 2 * DAY_MS).lastInsertRowid),
  ];
  const approvedPointAppId = Number(
    insertPointApp.run(eagle3Id, "approved", 20, now - 3 * DAY_MS).lastInsertRowid,
  );

  // Two currently active published activities (earliest-ending one is picked)
  const insertActivity = db.prepare(
    `INSERT INTO activities (title, description, mode, start_at, end_at, enroll_deadline, point_apply_deadline, target_points, status, featured, created_at)
     VALUES (?, ?, 'online', ?, ?, ?, ?, 10, 'published', 0, ?)`,
  );
  const activeActivityId = Number(
    insertActivity
      .run("进行中的活动", "进行中描述", now - 2 * 60 * 60 * 1000, now + 1 * DAY_MS, now, now + 2 * DAY_MS, now)
      .lastInsertRowid,
  );
  const laterActivityId = Number(
    insertActivity
      .run("稍后结束的活动", "稍后结束描述", now - 1 * DAY_MS, now + 5 * DAY_MS, now, now + 6 * DAY_MS, now)
      .lastInsertRowid,
  );

  // Enrollments: 3 enrolled in window, 1 cancelled in window (excluded), 1 old (outside window)
  const insertEnrollment = db.prepare(
    `INSERT INTO enrollments (user_id, activity_id, status, enrolled_at) VALUES (?, ?, ?, ?)`,
  );
  insertEnrollment.run(eagle1Id, activeActivityId, "enrolled", now - 1 * DAY_MS);
  insertEnrollment.run(eagle2Id, activeActivityId, "enrolled", now - 2 * DAY_MS);
  insertEnrollment.run(eagle3Id, laterActivityId, "enrolled", now - 3 * DAY_MS);
  insertEnrollment.run(eagle1Id, laterActivityId, "cancelled", now - 1 * DAY_MS);
  insertEnrollment.run(eagle2Id, laterActivityId, "enrolled", now - 15 * DAY_MS);

  // Point ledger: 2 positive + 1 negative in window, 1 old (outside window)
  const insertLedger = db.prepare(
    `INSERT INTO point_ledger (user_id, delta, balance_after, description, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  insertLedger.run(eagle1Id, 50, 50, "比赛获奖", now - 1 * DAY_MS);
  insertLedger.run(eagle2Id, 30, 80, "分享宣讲", now - 2 * DAY_MS);
  insertLedger.run(eagle2Id, -10, 70, "扣减", now - 3 * DAY_MS);
  insertLedger.run(eagle1Id, 100, 100, "历史入账", now - 15 * DAY_MS);

  return {
    pendingJoinIds,
    pendingPointAppIds,
    approvedPointAppId,
    activeActivityId,
  };
}

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-dashboard";
  migrate();
  seed();
  seeded = seedDashboardData();
});

async function loginAs(app: Express, role: "eagle" | "admin" | "super_admin") {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/demo-login").send({ role });
  expect(res.status).toBe(200);
  return agent;
}

describe("GET /api/admin/dashboard/summary", () => {
  let summary: Record<string, unknown>;

  beforeAll(async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");
    const res = await admin.get("/api/admin/dashboard/summary");
    expect(res.status).toBe(200);
    summary = res.body;
  });

  it("returns all summary fields", () => {
    for (const key of [
      "eagleCount",
      "pendingJoinCount",
      "pendingPointAppCount",
      "activeActivityCount",
      "enrollmentsLast7d",
      "ledgerCountLast7d",
      "ledgerPointsLast7d",
      "dailyStats",
      "generatedAt",
      "prevWeek",
      "sparklines",
      "pendingJoins",
      "pendingPointApps",
      "activeActivity",
      "dailyDetail",
    ]) {
      expect(summary).toHaveProperty(key);
    }

    expect(summary.eagleCount).toBe(3);
    // seed() adds 1 demo join application, 2 demo point applications, and
    // 2 demo enrollments for eagle@demo on top of the data seeded here.
    expect(summary.pendingJoinCount).toBe(3);
    expect(summary.pendingPointAppCount).toBe(4);
    expect(summary.activeActivityCount).toBe(2);
    expect(summary.enrollmentsLast7d).toBe(5);
    expect(summary.ledgerCountLast7d).toBe(3);
    expect(summary.ledgerPointsLast7d).toBe(80);
    expect(typeof summary.generatedAt).toBe("number");
    expect(Array.isArray(summary.dailyStats)).toBe(true);
    expect((summary.dailyStats as unknown[]).length).toBe(7);
  });

  it("dailyStats has 7 entries with date/enrollments/points structure", () => {
    const stats = summary.dailyStats as Array<{
      date: string;
      enrollments: number;
      points: number;
    }>;
    expect(stats).toHaveLength(7);

    const seenDates = new Set<string>();
    for (const entry of stats) {
      expect(entry.date).toMatch(/^\d{1,2}\/\d{1,2}$/);
      expect(typeof entry.enrollments).toBe("number");
      expect(typeof entry.points).toBe("number");
      seenDates.add(entry.date);
    }
    // 7 distinct consecutive days
    expect(seenDates.size).toBe(7);

    const totalEnrollments = stats.reduce((sum, e) => sum + e.enrollments, 0);
    const totalPoints = stats.reduce((sum, e) => sum + e.points, 0);
    expect(totalEnrollments).toBe(6); // 3 enrolled + 1 cancelled + 2 demo enrollments within window
    expect(totalPoints).toBe(80); // only positive deltas counted

    // oldest entry is the first one, i.e. 6 days ago
    expect(stats[0].date).toBe(dateLabel(6));
    expect(stats[6].date).toBe(dateLabel(0));
  });

  it("prevWeek has enrollments, points, ledgerCount numbers", () => {
    const prevWeek = summary.prevWeek as {
      enrollments: number;
      points: number;
      ledgerCount: number;
    };
    expect(typeof prevWeek.enrollments).toBe("number");
    expect(typeof prevWeek.points).toBe("number");
    expect(typeof prevWeek.ledgerCount).toBe("number");
    // No data was seeded in the previous window
    expect(prevWeek.enrollments).toBe(0);
    expect(prevWeek.points).toBe(0);
    expect(prevWeek.ledgerCount).toBe(0);
  });

  it("sparklines has enrollments and points arrays with date/value entries", () => {
    const sparklines = summary.sparklines as {
      enrollments: Array<{ date: string; value: number }>;
      points: Array<{ date: string; value: number }>;
    };
    expect(sparklines.enrollments).toHaveLength(7);
    expect(sparklines.points).toHaveLength(7);

    for (const series of [sparklines.enrollments, sparklines.points]) {
      for (const entry of series) {
        expect(entry.date).toMatch(/^\d{1,2}\/\d{1,2}$/);
        expect(typeof entry.value).toBe("number");
      }
    }
    // mirror of dailyStats
    expect(sparklines.enrollments.map((e) => e.value)).toEqual(
      (summary.dailyStats as Array<{ enrollments: number }>).map(
        (d) => d.enrollments,
      ),
    );
  });

  it("pendingJoins only includes pending join applications", () => {
    const joins = summary.pendingJoins as Array<{
      id: number;
      name: string;
      contact: string;
      createdAt: number;
    }>;
    expect(joins).toHaveLength(3); // +1 demo join application from seed()
    const demoJoinId = (
      getDb()
        .prepare(`SELECT id FROM join_applications WHERE name = '演示申请人'`)
        .get() as { id: number }
    ).id;
    const ids = joins.map((j) => j.id).sort();
    expect(ids).toEqual([...seeded.pendingJoinIds, demoJoinId].sort());
    for (const join of joins) {
      expect(typeof join.name).toBe("string");
      expect(typeof join.contact).toBe("string");
      expect(typeof join.createdAt).toBe("number");
    }
  });

  it("pendingPointApps only includes pending point applications", () => {
    const apps = summary.pendingPointApps as Array<{
      id: number;
      type: string;
      pointsRequested: number | null;
      createdAt: number;
      userDisplayName: string;
      aiScore: number | null;
      aiAction: string | null;
      riskLabel: string;
    }>;
    expect(apps).toHaveLength(4); // +2 demo point applications from seed()
    const demoAppIds = (
      getDb()
        .prepare(
          `SELECT id FROM point_applications
           WHERE activity_id IS NOT NULL OR template_code IS NOT NULL`,
        )
        .all() as { id: number }[]
    ).map((r) => r.id);
    const ids = apps.map((a) => a.id).sort();
    expect(ids).toEqual([...seeded.pendingPointAppIds, ...demoAppIds].sort());
    expect(ids).not.toContain(seeded.approvedPointAppId);
    for (const app of apps) {
      expect(["type1", "type2"]).toContain(app.type);
      expect(typeof app.userDisplayName).toBe("string");
      expect(typeof app.riskLabel).toBe("string");
    }
  });

  it("dailyDetail has one entry per day (7 total)", () => {
    const detail = summary.dailyDetail as Array<{
      date: string;
      enrollments: unknown[];
      ledger: unknown[];
    }>;
    expect(detail).toHaveLength(7);

    const dayAgo = detail.find((d) => d.date === dateLabel(1));
    expect(dayAgo).toBeDefined();
    expect(dayAgo!.enrollments).toHaveLength(3); // enrolled + cancelled + 1 demo enrollment
    expect(dayAgo!.ledger).toHaveLength(1);

    const threeDaysAgo = detail.find((d) => d.date === dateLabel(3));
    expect(threeDaysAgo).toBeDefined();
    expect(threeDaysAgo!.ledger).toHaveLength(1); // negative delta entry

    for (const entry of detail) {
      expect(entry.date).toMatch(/^\d{1,2}\/\d{1,2}$/);
      expect(Array.isArray(entry.enrollments)).toBe(true);
      expect(Array.isArray(entry.ledger)).toBe(true);
    }
  });

  it("activeActivity picks the earliest-ending active activity", () => {
    expect(summary.activeActivity).toMatchObject({
      id: seeded.activeActivityId,
      title: "进行中的活动",
      enrollmentCount: 2,
    });
    expect(typeof (summary.activeActivity as { endAt: number }).endAt).toBe(
      "number",
    );
  });
});

describe("dashboard access control", () => {
  it("returns 401 when not authenticated", async () => {
    const app = createApp();
    const res = await request(app).get("/api/admin/dashboard/summary");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("returns 403 for eagle role", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const res = await eagle.get("/api/admin/dashboard/summary");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("returns 200 for admin with dashboard permission", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");
    const res = await admin.get("/api/admin/dashboard/summary");
    expect(res.status).toBe(200);
    expect(res.body.eagleCount).toBe(3);
    expect(Array.isArray(res.body.dailyStats)).toBe(true);
  });
});
