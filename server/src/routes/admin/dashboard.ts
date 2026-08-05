import { Router } from "express";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DailyEnrollmentRecord {
  id: number;
  userName: string;
  activityTitle: string;
}

interface DailyLedgerRecord {
  id: number;
  delta: number;
  description: string;
}

export const adminDashboardRouter = Router();

adminDashboardRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("dashboard"),
);

adminDashboardRouter.get("/summary", (_req, res) => {
  const db = getDb();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;

  const eagleCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM users WHERE role = 'eagle' AND status = 'active'`,
      )
      .get() as { c: number }
  ).c;

  const pendingJoinCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM join_applications WHERE status = 'pending'`,
      )
      .get() as { c: number }
  ).c;

  const pendingPointAppCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM point_applications WHERE status = 'pending'`,
      )
      .get() as { c: number }
  ).c;

  const activeActivityCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM activities
         WHERE status = 'published' AND start_at <= ? AND end_at >= ?`,
      )
      .get(now, now) as { c: number }
  ).c;

  const enrollmentsLast7d = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM enrollments
         WHERE enrolled_at >= ? AND status = 'enrolled'`,
      )
      .get(sevenDaysAgo) as { c: number }
  ).c;

  const ledgerAgg = db
    .prepare(
      `SELECT COUNT(*) AS c, COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS points
       FROM point_ledger WHERE created_at >= ?`,
    )
    .get(sevenDaysAgo) as { c: number; points: number };

  // 环比数据: previous 7-day window (14 days ago -> 7 days ago)
  const prevWeekStart = now - 14 * DAY_MS;
  const prevWeekEnd = now - 7 * DAY_MS;

  const prevWeekEnrollments = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM enrollments WHERE enrolled_at >= ? AND enrolled_at < ?`,
      )
      .get(prevWeekStart, prevWeekEnd) as { c: number }
  ).c;

  const prevWeekPoints = (
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS p
         FROM point_ledger WHERE created_at >= ? AND created_at < ?`,
      )
      .get(prevWeekStart, prevWeekEnd) as { p: number }
  ).p;

  const prevWeekLedgerCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM point_ledger WHERE created_at >= ? AND created_at < ?`,
      )
      .get(prevWeekStart, prevWeekEnd) as { c: number }
  ).c;

  const prevWeek = {
    enrollments: prevWeekEnrollments,
    points: prevWeekPoints,
    ledgerCount: prevWeekLedgerCount,
  };

  const dayEnrollmentsStmt = db.prepare(
    `SELECT e.id, u.display_name AS userName, a.title AS activityTitle
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     JOIN activities a ON a.id = e.activity_id
     WHERE e.enrolled_at >= ? AND e.enrolled_at < ?
     ORDER BY e.enrolled_at ASC`,
  );
  const dayLedgerStmt = db.prepare(
    `SELECT id, delta, description FROM point_ledger
     WHERE created_at >= ? AND created_at < ?
     ORDER BY created_at ASC`,
  );

  // Daily stats for last 7 days
  const dailyStats: Array<{
    date: string;
    enrollments: number;
    points: number;
  }> = [];

  // 每日明细: actual enrollment/ledger records per day
  const dailyDetail: Array<{
    date: string;
    enrollments: DailyEnrollmentRecord[];
    ledger: DailyLedgerRecord[];
  }> = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayEnrollments = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM enrollments WHERE enrolled_at >= ? AND enrolled_at < ?`,
        )
        .get(dayStart.getTime(), dayEnd.getTime()) as { c: number }
    ).c;

    const dayPoints = (
      db
        .prepare(
          `SELECT COALESCE(SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END), 0) AS p
           FROM point_ledger WHERE created_at >= ? AND created_at < ?`,
        )
        .get(dayStart.getTime(), dayEnd.getTime()) as { p: number }
    ).p;

    const dateLabel = `${dayStart.getMonth() + 1}/${dayStart.getDate()}`;
    dailyStats.push({
      date: dateLabel,
      enrollments: dayEnrollments,
      points: dayPoints,
    });

    dailyDetail.push({
      date: dateLabel,
      enrollments: dayEnrollmentsStmt.all(
        dayStart.getTime(),
        dayEnd.getTime(),
      ) as DailyEnrollmentRecord[],
      ledger: dayLedgerStmt.all(
        dayStart.getTime(),
        dayEnd.getTime(),
      ) as DailyLedgerRecord[],
    });
  }

  // Sparkline data (7 entries each)
  const sparklines = {
    enrollments: dailyStats.map((d) => ({ date: d.date, value: d.enrollments })),
    points: dailyStats.map((d) => ({ date: d.date, value: d.points })),
  };

  // 待审预览队列: pending joins
  const pendingJoins = (
    db
      .prepare(
        `SELECT id, name, contact, created_at FROM join_applications
         WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5`,
      )
      .all() as Array<{ id: number; name: string; contact: string; created_at: number }>
  ).map((j) => ({
    id: j.id,
    name: j.name,
    contact: j.contact,
    createdAt: j.created_at,
  }));

  // 待审预览队列: pending point applications with AI review (AI风险排序)
  const pendingPointApps = (
    db
      .prepare(
        `SELECT pa.id, pa.type, pa.points_requested, pa.created_at,
                u.display_name AS user_display_name,
                ar.score AS ai_score, ar.recommended_action AS ai_action
         FROM point_applications pa
         JOIN users u ON u.id = pa.user_id
         LEFT JOIN ai_reviews ar ON ar.application_id = pa.id
         WHERE pa.status = 'pending'
         ORDER BY pa.created_at DESC LIMIT 8`,
      )
      .all() as Array<{
      id: number;
      type: string;
      points_requested: number | null;
      created_at: number;
      user_display_name: string;
      ai_score: number | null;
      ai_action: string | null;
    }>
  ).map((p) => ({
    id: p.id,
    type: p.type,
    pointsRequested: p.points_requested,
    createdAt: p.created_at,
    userDisplayName: p.user_display_name,
    aiScore: p.ai_score,
    aiAction: p.ai_action,
    riskLabel:
      p.ai_action === "approve"
        ? "🟢推荐通过"
        : p.ai_action === "review"
          ? "🟡建议复核"
          : p.ai_action === "reject"
            ? "🔴建议驳回"
            : "⚪未评估",
  }));

  // 进行中活动摘要: earliest-ending published activity in progress
  const activeActivityRow = db
    .prepare(
      `SELECT a.id, a.title, a.end_at, COUNT(e.id) AS enrollment_count
       FROM activities a
       LEFT JOIN enrollments e ON e.activity_id = a.id AND e.status = 'enrolled'
       WHERE a.status = 'published' AND a.start_at <= ? AND a.end_at >= ?
       GROUP BY a.id ORDER BY a.end_at ASC LIMIT 1`,
    )
    .get(now, now) as
    | { id: number; title: string; end_at: number; enrollment_count: number }
    | undefined;

  const activeActivity = activeActivityRow
    ? {
        id: activeActivityRow.id,
        title: activeActivityRow.title,
        endAt: activeActivityRow.end_at,
        enrollmentCount: activeActivityRow.enrollment_count,
      }
    : null;

  res.json({
    eagleCount,
    pendingJoinCount,
    pendingPointAppCount,
    activeActivityCount,
    enrollmentsLast7d,
    ledgerCountLast7d: ledgerAgg.c,
    ledgerPointsLast7d: ledgerAgg.points,
    dailyStats,
    prevWeek,
    sparklines,
    pendingJoins,
    pendingPointApps,
    activeActivity,
    dailyDetail,
    generatedAt: now,
  });
});
