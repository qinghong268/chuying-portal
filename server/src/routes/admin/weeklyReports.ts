import { Router } from "express";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";
import { deepseekChat } from "../../lib/deepseek";

const DAY_MS = 24 * 60 * 60 * 1000;

interface WeeklyReportRow {
  id: number;
  user_id: number;
  week_start: string;
  enrollments_count: number;
  courses_progressed: number;
  points_earned: number;
  applications_count: number;
  ai_summary: string | null;
  created_at: number;
  user_display_name?: string;
}

interface WeeklyStats {
  enrollmentsCount: number;
  coursesProgressed: number;
  pointsEarned: number;
  applicationsCount: number;
}

/** Monday of the current week as YYYY-MM-DD (weeks start on Monday in China). */
function getWeekStartDate(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysSinceMonday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayStr = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

function computeWeeklyStats(userId: number, windowStart: number): WeeklyStats {
  const enrollmentsCount = (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM enrollments
         WHERE user_id = ? AND enrolled_at >= ? AND status = 'enrolled'`,
      )
      .get(userId, windowStart) as { c: number }
  ).c;

  const coursesProgressed = (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM course_progress
         WHERE user_id = ? AND updated_at >= ? AND percent > 0`,
      )
      .get(userId, windowStart) as { c: number }
  ).c;

  const pointsEarned = (
    getDb()
      .prepare(
        `SELECT COALESCE(SUM(delta), 0) AS p FROM point_ledger
         WHERE user_id = ? AND created_at >= ? AND delta > 0`,
      )
      .get(userId, windowStart) as { p: number }
  ).p;

  const applicationsCount = (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM point_applications
         WHERE user_id = ? AND created_at >= ?`,
      )
      .get(userId, windowStart) as { c: number }
  ).c;

  return {
    enrollmentsCount,
    coursesProgressed,
    pointsEarned,
    applicationsCount,
  };
}

async function generateAiSummary(
  displayName: string,
  stats: WeeklyStats,
): Promise<string> {
  const dataLines = [
    `本周新增报名活动：${stats.enrollmentsCount} 个`,
    `本周有学习进度的课程：${stats.coursesProgressed} 门`,
    `本周获得积分：${stats.pointsEarned} 分`,
    `本周提交积分申请：${stats.applicationsCount} 次`,
  ];

  const prompt = `请为雏英计划学员「${displayName}」撰写本周学习周报总结，数据如下：
${dataLines.join("\n")}

要求（共2-3句话，直接输出总结文字，不要标题、列表或多余内容）：
- 必须引用具体数字（如"报名了2个活动"、"获得15积分"），不要说"有所进步"这类空话；
- 第一句：总结本周学习表现，肯定做得好的方面；
- 第二句：结合数据指出可改进之处（若数据无明显短板，则给出下一步提升建议）；
- 最后附一句简短、真诚的鼓励语；
- 语气亲切、有温度，使用中文。`;

  return deepseekChat(
    [
      {
        role: "system",
        content: "你是一位雏英计划的学习成长顾问，善于根据数据撰写简洁、有温度、可执行的周报总结。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.7, maxTokens: 300 },
  );
}

function upsertWeeklyReport(
  userId: number,
  weekStart: string,
  stats: WeeklyStats,
  aiSummary: string | null,
  now: number,
): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO weekly_reports
       (user_id, week_start, enrollments_count, courses_progressed, points_earned, applications_count, ai_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      weekStart,
      stats.enrollmentsCount,
      stats.coursesProgressed,
      stats.pointsEarned,
      stats.applicationsCount,
      aiSummary,
      now,
    );
}

function toPublicReport(row: WeeklyReportRow) {
  return {
    id: row.id,
    userId: row.user_id,
    userDisplayName: row.user_display_name ?? null,
    weekStart: row.week_start,
    enrollmentsCount: row.enrollments_count,
    coursesProgressed: row.courses_progressed,
    pointsEarned: row.points_earned,
    applicationsCount: row.applications_count,
    aiSummary: row.ai_summary,
    createdAt: row.created_at,
  };
}

export const adminWeeklyReportsRouter = Router();

adminWeeklyReportsRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("user"),
);

// POST /generate — Generate weekly reports for ALL active eagles
adminWeeklyReportsRouter.post("/generate", async (_req, res) => {
  const now = Date.now();
  const weekStart = getWeekStartDate();
  const windowStart = now - 7 * DAY_MS;

  const eagles = getDb()
    .prepare(
      `SELECT id, display_name FROM users
       WHERE role = 'eagle' AND status = 'active'`,
    )
    .all() as Array<{ id: number; display_name: string }>;

  let generated = 0;
  let failed = 0;

  for (const eagle of eagles) {
    try {
      const stats = computeWeeklyStats(eagle.id, windowStart);
      let aiSummary: string | null = null;
      try {
        aiSummary = await generateAiSummary(eagle.display_name, stats);
      } catch {
        // AI summary is best-effort: keep the stats-only report on failure
      }
      upsertWeeklyReport(eagle.id, weekStart, stats, aiSummary, now);
      generated += 1;
    } catch {
      failed += 1;
    }
  }

  res.json({ generated, failed, weekStart });
});

// GET / — List all weekly reports, grouped by week_start
adminWeeklyReportsRouter.get("/", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT wr.*, u.display_name AS user_display_name
       FROM weekly_reports wr
       JOIN users u ON u.id = wr.user_id
       ORDER BY wr.week_start DESC, wr.user_id ASC`,
    )
    .all() as WeeklyReportRow[];

  const weeks: Array<{ weekStart: string; reports: ReturnType<typeof toPublicReport>[] }> = [];
  for (const row of rows) {
    let week = weeks.find((w) => w.weekStart === row.week_start);
    if (!week) {
      week = { weekStart: row.week_start, reports: [] };
      weeks.push(week);
    }
    week.reports.push(toPublicReport(row));
  }

  res.json({ weeks });
});
