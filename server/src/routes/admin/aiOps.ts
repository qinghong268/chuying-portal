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
let cachedInsight: { summary: string; alerts: string[]; suggestions: string[]; generatedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

adminAiOpsRouter.get("/insight", async (req, res) => {
  // Return cached if fresh
  if (cachedInsight && Date.now() - cachedInsight.generatedAt < CACHE_TTL) {
    res.json({
      summary: cachedInsight.summary,
      alerts: cachedInsight.alerts,
      suggestions: cachedInsight.suggestions,
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

    // Previous 7 days stats (for trend comparison)
    const prevWeekEnrollments = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM enrollments WHERE enrolled_at >= ? AND enrolled_at < ?`,
        )
        .get(now - 14 * 86400000, now - 7 * 86400000) as { c: number }
    ).c;
    const prevWeekPoints = (
      db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS p
           FROM point_ledger WHERE created_at >= ? AND created_at < ?`,
        )
        .get(now - 14 * 86400000, now - 7 * 86400000) as { p: number }
    ).p;

    const enrollTrend =
      weekEnrollments > prevWeekEnrollments ? "较前一周上升" : weekEnrollments < prevWeekEnrollments ? "较前一周下降" : "与前一周持平";
    const pointsTrend =
      weekPoints > prevWeekPoints ? "较前一周上升" : weekPoints < prevWeekPoints ? "较前一周下降" : "与前一周持平";

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
    const dataContext = `当前数据：活跃雏英${eagleCount}人，进行中活动${activeActivities}个，待审加入${pendingJoins}条，待审积分${pendingPoints}条（类型一${type1Count}条/类型二${type2Count}条）；近7日新增报名${weekEnrollments}人（前一周${prevWeekEnrollments}人，${enrollTrend}），近7日发放积分${weekPoints}分（前一周${prevWeekPoints}分，${pointsTrend}）。`;

    const response = await deepseekChat(
      [
        {
          role: "system",
          content:
            "你是雏英计划运营数据分析师。根据给定的运营数据生成结构化运营简报，必须只返回以下JSON（不要输出任何其他内容或Markdown代码块）：\n{\"summary\":\"一句话总结\",\"alerts\":[\"预警\"],\"suggestions\":[\"建议\"]}\n\n要求：\n- summary：一句话概括整体运营状况，不超过50字；\n- alerts：1-2条，指出需要关注的异常或事项（如待审积压、报名下滑、积分发放异常）；\n- suggestions：1-2条，给出具体可执行的操作建议；\n- 所有条目均不超过50字，语言简洁务实，全部使用中文。",
        },
        { role: "user", content: dataContext },
      ],
      { temperature: 0.5, maxTokens: 400 },
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    const insight = {
      summary: (parsed?.summary as string) || response.slice(0, 200),
      alerts: (parsed?.alerts as string[]) || [],
      suggestions: (parsed?.suggestions as string[]) || [],
    };

    cachedInsight = { ...insight, generatedAt: Date.now() };

    res.json({
      ...insight,
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
