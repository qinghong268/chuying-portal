import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed } from "../src/db";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-join";
  migrate();
  seed();
});

describe("POST /api/join contact validation", () => {
  const validPayload = {
    name: "李四",
    message: "希望加入雏英计划，学习成长。",
  };

  it("rejects invalid contact with 400", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/join")
      .send({ ...validPayload, contact: "bad-phone" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mobile|email|Contact/i);
  });

  it("accepts valid mainland mobile with 201", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/join")
      .send({ ...validPayload, contact: "13800138000" });
    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe("pending");
  });

  it("accepts valid email with 201", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/join")
      .send({ ...validPayload, contact: "join@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe("pending");
  });
});
