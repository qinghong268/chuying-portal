import { Router } from "express";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

export const adminDashboardRouter = Router();

adminDashboardRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("dashboard"),
);

adminDashboardRouter.get("/summary", (_req, res) => {
  const db = getDb();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

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

  res.json({
    eagleCount,
    pendingJoinCount,
    pendingPointAppCount,
    activeActivityCount,
    enrollmentsLast7d,
    ledgerCountLast7d: ledgerAgg.c,
    ledgerPointsLast7d: ledgerAgg.points,
    generatedAt: now,
  });
});
