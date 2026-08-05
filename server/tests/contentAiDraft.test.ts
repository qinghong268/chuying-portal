import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed } from "../src/db";

// Mock the DeepSeek API client so tests never hit the real endpoint.
vi.mock("../src/lib/deepseek", () => ({
  deepseekChat: vi.fn(),
}));

import { deepseekChat } from "../src/lib/deepseek";

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-ai-draft";
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

describe("admin content — AI draft generation", () => {
  it("returns title/summary/body draft for a topic as super admin", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(
      JSON.stringify({
        title: "雏英计划介绍",
        summary: "面向大学生的成长实践计划。",
        body: "<h2>雏英计划介绍</h2><p>通过实践活动提升综合能力。</p>",
      }),
    );

    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    const res = await superAdmin
      .post("/api/admin/content/blocks/ai-draft")
      .send({ topic: "雏英计划介绍" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: "雏英计划介绍",
      summary: "面向大学生的成长实践计划。",
      body: "<h2>雏英计划介绍</h2><p>通过实践活动提升综合能力。</p>",
    });
    expect(deepseekChat).toHaveBeenCalledTimes(1);

    const [messages, options] = vi.mocked(deepseekChat).mock.calls[0];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("雏英计划");
    expect(messages[1]).toEqual({ role: "user", content: "雏英计划介绍" });
    expect(options).toEqual({ temperature: 0.7, maxTokens: 800 });
  });

  it("tolerates prose-wrapped JSON from the AI", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(
      '以下是生成的草稿：{"title":"迎新活动","summary":"活动简介","body":"<h2>迎新活动</h2><p>详情</p>"}',
    );

    const app = createApp();
    const admin = await loginAs(app, "admin");
    const res = await admin
      .post("/api/admin/content/blocks/ai-draft")
      .send({ topic: "雏英计划2026届迎新活动" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("迎新活动");
    expect(res.body.summary).toBe("活动简介");
    expect(res.body.body).toContain("<h2>迎新活动</h2>");
  });

  it("rejects a missing or blank topic with 400", async () => {
    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");

    const blank = await superAdmin
      .post("/api/admin/content/blocks/ai-draft")
      .send({ topic: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body.error).toBe("请输入内容主题");

    const missing = await superAdmin
      .post("/api/admin/content/blocks/ai-draft")
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe("请输入内容主题");
  });

  it("returns 502 when the DeepSeek call fails", async () => {
    vi.mocked(deepseekChat).mockRejectedValue(
      new Error("DeepSeek API error 429: rate limited"),
    );

    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    const res = await superAdmin
      .post("/api/admin/content/blocks/ai-draft")
      .send({ topic: "迎新活动" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("AI内容生成失败，请稍后重试");
  });

  it("returns 502 when the AI response contains no JSON", async () => {
    vi.mocked(deepseekChat).mockResolvedValue("抱歉，我无法回答该问题。");

    const app = createApp();
    const superAdmin = await loginAs(app, "super_admin");
    const res = await superAdmin
      .post("/api/admin/content/blocks/ai-draft")
      .send({ topic: "测试" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("AI内容生成失败，请稍后重试");
  });
});
