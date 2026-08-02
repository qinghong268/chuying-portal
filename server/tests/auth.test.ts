import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-auth";
  migrate();
  seed();
});

describe("POST /api/auth/demo-login", () => {
  it("demo-login as eagle returns role eagle", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/auth/demo-login")
      .send({ role: "eagle" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("eagle");
    expect(res.body.user.email).toBe("eagle@demo");
    expect(res.body.user).not.toHaveProperty("password_hash");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("demo-login with invalid role returns 400", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/auth/demo-login")
      .send({ role: "invalid" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  it("me requires auth", async () => {
    const app = createApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("me returns user after demo-login", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "eagle" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("eagle");
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("me returns permissions for admin", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "admin" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.permissions).toBeInstanceOf(Array);
    expect(res.body.user.permissions).not.toContain("permission");
    expect(res.body.user.permissions).toContain("content");
  });

  it("me returns all permissions for super_admin", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "super_admin" });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user.permissions).toContain("permission");
  });
});

describe("POST /api/auth/logout", () => {
  it("logout clears session", async () => {
    const app = createApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/demo-login").send({ role: "admin" });
    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);
    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(401);
  });
});

describe("disabled user session invalidation", () => {
  it("disabled user gets 401 on protected routes with existing cookie", async () => {
    const app = createApp();
    const eagle = request.agent(app);
    await eagle.post("/api/auth/demo-login").send({ role: "eagle" });
    const meBefore = await eagle.get("/api/auth/me");
    expect(meBefore.status).toBe(200);

    const eagleRow = getDb()
      .prepare(`SELECT id FROM users WHERE email = 'eagle@demo'`)
      .get() as { id: number };

    const superAdmin = request.agent(app);
    await superAdmin.post("/api/auth/demo-login").send({ role: "super_admin" });
    const disableRes = await superAdmin.post(
      `/api/admin/users/${eagleRow.id}/disable`,
    );
    expect(disableRes.status).toBe(200);

    const meAfter = await eagle.get("/api/auth/me");
    expect(meAfter.status).toBe(401);

    const activitiesRes = await eagle.get("/api/activities");
    expect(activitiesRes.status).toBe(200);

    const enrollRes = await eagle.post("/api/activities/1/enroll");
    expect(enrollRes.status).toBe(401);
  });
});
