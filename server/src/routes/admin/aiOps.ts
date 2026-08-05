import { Router } from "express";
import { deepseekChat } from "../../lib/deepseek";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

export const adminAiOpsRouter = Router();

adminAiOpsRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("dashboard"),
);

// Simple in-memory cache (5 min TTL)
let cachedInsight: { text: string; generatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

adminAiOpsRouter.get("/insight", async (req, res) => {
  // Return cached if fresh
  if (cachedInsight && Date.now() - cachedInsight.generatedAt < CACHE_TTL) {
    res.json({
      insight: cachedInsight.text,
      cached: true,
      generatedAt: cachedInsight.generatedAt,
    });
    return;
  }

  try {
    // Gather dashboard data
    const db = getDb();
    const now = Date.now();

    const pendingJoins = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM join_applications WHERE status = 'pending'`,
        )
        .get() as { c: number }
    ).c;
    const pendingPoints = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM point_applications WHERE status = 'pending'`,
        )
        .get() as { c: number }
    ).c;
    const eagleCount = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM users WHERE role = 'eagle' AND status = 'active'`,
        )
        .get() as { c: number }
    ).c;
    const activeActivities = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM activities
           WHERE status = 'published' AND start_at <= ? AND end_at >= ?`,
        )
        .get(now, now) as { c: number }
    ).c;

    // Last 7 days stats
    const weekEnrollments = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM enrollments WHERE enrolled_at >= ?`,
        )
        .get(now - 7 * 86400000) as { c: number }
    ).c;
    const weekPoints = (
      db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS p
           FROM point_ledger WHERE created_at >= ?`,
        )
        .get(now - 7 * 86400000) as { p: number }
    ).p;

    // Type distribution in pending apps
    const type1Count = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM point_applications WHERE status = 'pending' AND type = 'type1'`,
        )
        .get() as { c: number }
    ).c;
    const type2Count = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM point_applications WHERE status = 'pending' AND type = 'type2'`,
        )
        .get() as { c: number }
    ).c;

    // Build data payload and call DeepSeek
    const dataContext = `当前数据：活跃雏英${eagleCount}人，进行中活动${activeActivities}个，待审加入${pendingJoins}条，待审积分${pendingPoints}条（类型一${type1Count}条/类型二${type2Count}条），近7日新增报名${weekEnrollments}人，发放积分${weekPoints}分。`;

    const response = await deepseekChat(
      [
        {
          role: "system",
          content:
            "你是雏英计划运营数据分析师。根据给定的运营数据生成结构化简报。以JSON格式返回：{summary, alerts[], suggestions[]}。summary是2-3句话的运营概况。alerts是0-3条预警。suggestions是1-3条运营建议。每项不超过80字。",
        },
        { role: "user", content: dataContext },
      ],
      { temperature: 0.5, maxTokens: 600 },
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const insight = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { summary: response, alerts: [], suggestions: [] };

    const text =
      typeof insight === "string" ? insight : JSON.stringify(insight);
    cachedInsight = { text, generatedAt: Date.now() };

    res.json({
      insight: text,
      cached: false,
      generatedAt: cachedInsight.generatedAt,
    });
  } catch (err) {
    console.error("AI insight error:", err);
    res.status(502).json({ error: "AI服务暂时不可用" });
  }
});

// Force refresh
adminAiOpsRouter.post("/insight/refresh", (req, res) => {
  cachedInsight = null;
  res.json({ ok: true });
});
