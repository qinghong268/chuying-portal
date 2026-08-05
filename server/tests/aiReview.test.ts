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
  process.env.JWT_SECRET = "test-secret-for-ai-review";
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
      "AI 审核测试活动",
      "活动描述：AI 审核辅助测试",
      now + hour,
      now - hour,
      now + hour,
      now + 2 * day,
      targetPoints,
      now,
    );
  return Number(insert.lastInsertRowid);
}

async function createPendingApplication(
  app: ReturnType<typeof createApp>,
): Promise<{ agent: request.Agent; applicationId: number; activityId: number }> {
  const eagle = await loginAs(app, "eagle");
  const activityId = createEndedOnlineActivity(15);
  await eagle.post(`/api/activities/${activityId}/enroll`);
  const applyRes = await eagle.post("/api/me/point-applications").send({
    type: "type1",
    activityId,
    reflection: reflectionOk,
  });
  expect(applyRes.status).toBe(201);
  return {
    agent: eagle,
    applicationId: applyRes.body.application.id as number,
    activityId,
  };
}

describe("admin point application — AI review", () => {
  it("generates an AI review, persists it, and includes it in GET /:id", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(
      JSON.stringify({
        score: 8,
        relevance: 9,
        suggestion: "心得结构完整、表达流畅，与活动主题高度相关，建议通过。",
        recommendedAction: "approve",
        suggestedPoints: 12,
        draftRejectReason: "",
      }),
    );

    const app = createApp();
    const { applicationId } = await createPendingApplication(app);

    const admin = await loginAs(app, "admin");
    const aiRes = await admin.post(
      `/api/admin/point-applications/${applicationId}/ai-review`,
    );
    expect(aiRes.status).toBe(200);
    expect(aiRes.body.aiReview).toMatchObject({
      score: 8,
      relevance: 9,
      recommendedAction: "approve",
      suggestedPoints: 12,
    });
    expect(aiRes.body.aiReview.suggestion).toContain("建议通过");
    expect(deepseekChat).toHaveBeenCalledTimes(1);

    // Persisted and returned by the detail endpoint
    const detailRes = await admin.get(
      `/api/admin/point-applications/${applicationId}`,
    );
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.application.aiReview).toMatchObject({
      score: 8,
      relevance: 9,
      recommendedAction: "approve",
    });

    // Exactly one row in ai_reviews
    const count = (
      getDb()
        .prepare(`SELECT COUNT(*) AS c FROM ai_reviews WHERE application_id = ?`)
        .get(applicationId) as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("regenerating an AI review upserts instead of inserting a duplicate", async () => {
    vi.mocked(deepseekChat).mockResolvedValue(
      JSON.stringify({
        score: 5,
        relevance: 6,
        suggestion: "心得与主题部分相关，建议人工复核。",
        recommendedAction: "review",
        suggestedPoints: 10,
        draftRejectReason: "",
      }),
    );

    const app = createApp();
    const { applicationId } = await createPendingApplication(app);

    const admin = await loginAs(app, "admin");
    const first = await admin.post(
      `/api/admin/point-applications/${applicationId}/ai-review`,
    );
    expect(first.status).toBe(200);

    vi.mocked(deepseekChat).mockResolvedValue(
      JSON.stringify({
        score: 3,
        relevance: 4,
        suggestion: "心得与活动主题关联较弱，建议驳回并修改后重新提交。",
        recommendedAction: "reject",
        suggestedPoints: 0,
        draftRejectReason: "心得内容与活动主题关联较弱，请补充具体收获后重新提交。",
      }),
    );

    const second = await admin.post(
      `/api/admin/point-applications/${applicationId}/ai-review`,
    );
    expect(second.status).toBe(200);
    expect(second.body.aiReview).toMatchObject({
      score: 3,
      recommendedAction: "reject",
      suggestedPoints: 0,
    });
    expect(second.body.aiReview.draftRejectReason).toContain("关联较弱");

    const count = (
      getDb()
        .prepare(`SELECT COUNT(*) AS c FROM ai_reviews WHERE application_id = ?`)
        .get(applicationId) as { c: number }
    ).c;
    expect(count).toBe(1);
  });

  it("returns 502 when the DeepSeek call fails and stores nothing", async () => {
    vi.mocked(deepseekChat).mockRejectedValue(
      new Error("DeepSeek API error 429: rate limited"),
    );

    const app = createApp();
    const { applicationId } = await createPendingApplication(app);

    const admin = await loginAs(app, "admin");
    const aiRes = await admin.post(
      `/api/admin/point-applications/${applicationId}/ai-review`,
    );
    expect(aiRes.status).toBe(502);
    expect(aiRes.body.error).toContain("AI 审核生成失败");

    const count = (
      getDb()
        .prepare(`SELECT COUNT(*) AS c FROM ai_reviews WHERE application_id = ?`)
        .get(applicationId) as { c: number }
    ).c;
    expect(count).toBe(0);
  });

  it("rejects AI review for a type2 application without reflection", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");
    const applyRes = await eagle.post("/api/me/point-applications").send({
      type: "type2",
      templateCode: "contest_award",
      title: "校内编程比赛一等奖",
      reason: "获得校内编程比赛一等奖，特此申请积分奖励。",
    });
    expect(applyRes.status).toBe(201);
    const applicationId = applyRes.body.application.id as number;

    const admin = await loginAs(app, "admin");
    const aiRes = await admin.post(
      `/api/admin/point-applications/${applicationId}/ai-review`,
    );
    expect(aiRes.status).toBe(400);
    expect(aiRes.body.error).toContain("reflection");
  });
});
