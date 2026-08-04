import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-public-api";
  migrate();
  seed();
});

describe("GET /api/content/home", () => {
  it("returns published home blocks", async () => {
    const app = createApp();
    const res = await request(app).get("/api/content/home");
    expect(res.status).toBe(200);
    expect(res.body.blocks.length).toBeGreaterThanOrEqual(3);
    expect(res.body.blocks.some((b: { key: string }) => b.key === "home_hero")).toBe(
      true,
    );
  });
});

describe("GET /api/activities", () => {
  it("lists published activities", async () => {
    const app = createApp();
    const res = await request(app).get("/api/activities");
    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(2);
  });

  it("featured returns limited activities", async () => {
    const app = createApp();
    const res = await request(app).get("/api/activities/featured?limit=1");
    expect(res.status).toBe(200);
    expect(res.body.activities).toHaveLength(1);
  });
});

describe("GET /api/courses", () => {
  it("lists published courses", async () => {
    const app = createApp();
    const res = await request(app).get("/api/courses");
    expect(res.status).toBe(200);
    expect(res.body.courses.length).toBeGreaterThanOrEqual(2);
  });

  it("featured returns limited courses", async () => {
    const app = createApp();
    const res = await request(app).get("/api/courses/featured?limit=1");
    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
  });
});

describe("POST /api/join", () => {
  it("accepts guest join application", async () => {
    const app = createApp();
    const res = await request(app).post("/api/join").send({
      name: "张三",
      contact: "zhangsan@example.com",
      message: "希望加入雏英计划，学习成长。",
    });
    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe("pending");
  });

  it("rejects empty body", async () => {
    const app = createApp();
    const res = await request(app).post("/api/join").send({});
    expect(res.status).toBe(400);
  });
});

describe("activity enroll and progress", () => {
  it("eagle can enroll and update progress", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "eagle" });

    const listRes = await agent.get("/api/activities");
    const online = listRes.body.activities.find(
      (a: { mode: string }) => a.mode === "online",
    );
    expect(online).toBeDefined();

    const enrollRes = await agent.post(`/api/activities/${online.id}/enroll`);
    expect(enrollRes.status).toBe(201);

    const progressRes = await agent
      .put(`/api/activities/${online.id}/progress`)
      .send({ percent: 50 });
    expect(progressRes.status).toBe(200);
    expect(progressRes.body.progress.percent).toBe(50);

    const detailRes = await agent.get(`/api/activities/${online.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.activity.enrolled).toBe(true);
    expect(detailRes.body.activity.progressPercent).toBe(50);
  });

  it("enroll requires eagle role", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "admin" });
    const res = await agent.post("/api/activities/1/enroll");
    expect(res.status).toBe(403);
  });

  it("progress rejects invalid percent", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "eagle" });
    await agent.post("/api/activities/1/enroll");
    const res = await agent
      .put("/api/activities/1/progress")
      .send({ percent: 101 });
    expect(res.status).toBe(400);
  });

  it("progress requires enrollment", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "eagle" });
    const res = await agent
      .put("/api/activities/2/progress")
      .send({ percent: 50 });
    expect(res.status).toBe(403);
  });
});
