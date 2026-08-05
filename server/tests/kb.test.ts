import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { migrate, seed, getDb } from "../src/db";
import { retrieveRelevantDocs } from "../src/routes/kbChat";

const { deepseekChatMock } = vi.hoisted(() => ({
  deepseekChatMock: vi.fn(async (): Promise<string> => "mock answer"),
}));

vi.mock("../src/lib/deepseek", () => ({
  deepseekChat: deepseekChatMock,
}));

beforeAll(() => {
  process.env.DATABASE_PATH = ":memory:";
  process.env.JWT_SECRET = "test-secret-for-kb";
  migrate();
  seed();
});

beforeEach(() => {
  getDb().prepare(`DELETE FROM kb_documents`).run();
  deepseekChatMock.mockReset();
  deepseekChatMock.mockImplementation(async () => "mock answer");
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

describe("admin KB permission gates", () => {
  it("eagle calling admin KB API gets 403", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    const res = await eagle.get("/api/admin/kb");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");

    const postRes = await eagle.post("/api/admin/kb").send({
      title: "越权文档",
      content: "x",
    });
    expect(postRes.status).toBe(403);
  });
});

describe("admin KB CRUD", () => {
  it("create, list, get, update, delete documents", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");

    // empty list initially
    const emptyRes = await admin.get("/api/admin/kb");
    expect(emptyRes.status).toBe(200);
    expect(emptyRes.body.documents).toEqual([]);

    // create
    const createRes = await admin.post("/api/admin/kb").send({
      title: "积分规则",
      content: "完成线上活动可获得积分，积分可用于兑换奖励。",
    });
    expect(createRes.status).toBe(201);
    const doc = createRes.body.document as {
      id: number;
      title: string;
      content: string;
      createdAt: number;
      updatedAt: number;
    };
    expect(doc.title).toBe("积分规则");
    expect(doc.content).toContain("兑换奖励");
    expect(typeof doc.createdAt).toBe("number");
    expect(typeof doc.updatedAt).toBe("number");

    // validation: empty title rejected
    const badRes = await admin.post("/api/admin/kb").send({ title: "  " });
    expect(badRes.status).toBe(400);

    // list (summary only)
    const listRes = await admin.get("/api/admin/kb");
    expect(listRes.status).toBe(200);
    expect(listRes.body.documents).toHaveLength(1);
    expect(listRes.body.documents[0].id).toBe(doc.id);
    expect(listRes.body.documents[0].title).toBe("积分规则");
    expect(listRes.body.documents[0].content).toBeUndefined();

    // get single
    const getRes = await admin.get(`/api/admin/kb/${doc.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.document.content).toContain("兑换奖励");

    // update
    const putRes = await admin.put(`/api/admin/kb/${doc.id}`).send({
      title: "积分规则（修订）",
      content: "完成线上活动可获得 10 积分，积分可用于兑换奖励与礼品。",
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.document.title).toBe("积分规则（修订）");
    expect(putRes.body.document.content).toContain("10 积分");

    // partial update keeps other field
    const partialRes = await admin.put(`/api/admin/kb/${doc.id}`).send({
      title: "积分规则 V2",
    });
    expect(partialRes.status).toBe(200);
    expect(partialRes.body.document.title).toBe("积分规则 V2");
    expect(partialRes.body.document.content).toContain("10 积分");

    // 404 on missing id
    const missingRes = await admin.get("/api/admin/kb/99999");
    expect(missingRes.status).toBe(404);

    // delete + 404 on re-delete
    const delRes = await admin.delete(`/api/admin/kb/${doc.id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);

    const del404 = await admin.delete(`/api/admin/kb/${doc.id}`);
    expect(del404.status).toBe(404);

    const finalList = await admin.get("/api/admin/kb");
    expect(finalList.body.documents).toEqual([]);
  });
});

describe("KB chat API (RAG)", () => {
  it("requires auth (401) and eagle role (403 for admin)", async () => {
    const app = createApp();

    const anonRes = await request(app)
      .post("/api/kb-chat")
      .send({ question: "你好" });
    expect(anonRes.status).toBe(401);

    const admin = await loginAs(app, "admin");
    const adminRes = await admin.post("/api/kb-chat").send({ question: "你好" });
    expect(adminRes.status).toBe(403);
  });

  it("rejects empty question with 400", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    const emptyRes = await eagle.post("/api/kb-chat").send({ question: "   " });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.error).toBe("请输入问题");

    const missingRes = await eagle.post("/api/kb-chat").send({});
    expect(missingRes.status).toBe(400);
  });

  it("grounds the answer in the matching KB document", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");

    await admin.post("/api/admin/kb").send({
      title: "积分规则",
      content: "完成线上活动可获得积分，积分可兑换奖励与礼品。",
    });
    await admin.post("/api/admin/kb").send({
      title: "课程安排",
      content: "雏英计划每季度开设三期课程，包含技术与管理方向。",
    });

    const eagle = await loginAs(app, "eagle");
    const res = await eagle
      .post("/api/kb-chat")
      .send({ question: "积分怎么获得？" });
    expect(res.status).toBe(200);
    expect(res.body.answer).toBe("mock answer");

    expect(deepseekChatMock).toHaveBeenCalledTimes(1);
    const messages = deepseekChatMock.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    const system = messages.find((m) => m.role === "system");
    expect(system).toBeDefined();
    // RAG: the matching doc title is injected as reference material
    expect(system!.content).toContain("积分规则");
    expect(system!.content).toContain("【参考资料1】");
    expect(system!.content).toContain("兑换奖励");
    // The course doc (no keyword overlap) is not included
    expect(system!.content).not.toContain("课程安排");

    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg!.content).toBe("积分怎么获得？");
  });

  it("falls back to the first docs when no document matches", async () => {
    const app = createApp();
    const admin = await loginAs(app, "admin");

    await admin.post("/api/admin/kb").send({
      title: "积分规则",
      content: "完成线上活动可获得积分，积分可兑换奖励与礼品。",
    });

    const eagle = await loginAs(app, "eagle");
    const res = await eagle
      .post("/api/kb-chat")
      .send({ question: "食堂几点开门？" });
    expect(res.status).toBe(200);

    const messages = deepseekChatMock.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    const system = messages.find((m) => m.role === "system");
    // No keyword match → retrieval falls back to the first docs as context
    expect(system!.content).not.toContain("暂无相关参考资料");
    expect(system!.content).toContain("【参考资料1】");
    expect(system!.content).toContain("兑换奖励");
  });

  it("uses generic context when the knowledge base is empty", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    const res = await eagle.post("/api/kb-chat").send({ question: "你好吗？" });
    expect(res.status).toBe(200);

    const messages = deepseekChatMock.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    const system = messages.find((m) => m.role === "system");
    expect(system!.content).toContain("暂无相关参考资料");
  });

  it("returns 500 when the LLM service fails", async () => {
    const app = createApp();
    const eagle = await loginAs(app, "eagle");

    deepseekChatMock.mockRejectedValueOnce(new Error("upstream down"));
    const res = await eagle.post("/api/kb-chat").send({ question: "你好" });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("AI服务暂时不可用，请稍后重试");
  });
});

describe("retrieveRelevantDocs", () => {
  it("returns top matching docs with title prefix, capped at 3", () => {
    const now = Date.now();
    const insert = getDb().prepare(
      `INSERT INTO kb_documents (title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
    );
    insert.run("积分规则", "完成线上活动可获得积分，积分可兑换奖励。", now, now);
    insert.run("课程安排", "每季度开设三期课程。", now, now);
    insert.run("活动报名", "活动报名截止时间为活动开始前 24 小时。", now, now);
    insert.run("食堂指南", "食堂开放时间为每日 11:00-13:00。", now, now);

    const hits = retrieveRelevantDocs("积分 兑换 活动");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain("积分规则");
    expect(hits.every((h) => h.startsWith("积分规则") || h.startsWith("活动报名"))).toBe(
      true,
    );
    expect(hits.join("\n")).not.toContain("食堂");

    // no matches → first 3 docs
    const miss = retrieveRelevantDocs("zzzqqq");
    expect(miss).toHaveLength(3);
  });

  it("returns [] when the knowledge base is empty", () => {
    expect(retrieveRelevantDocs("任何问题")).toEqual([]);
  });
});
