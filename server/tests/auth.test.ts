import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed } from "../src/db";

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
