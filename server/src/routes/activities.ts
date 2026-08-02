import { Router } from "express";
import { getDb } from "../connection";
import { optionalAuth } from "../middleware/auth";
import { canEnrollActivity } from "../domain/enrollment";

interface ActivityRow {
  id: number;
  title: string;
  description: string;
  mode: "online" | "offline";
  start_at: number;
  end_at: number;
  enroll_deadline: number;
  target_points: number;
  status: string;
  featured: number;
  created_at: number;
}

function toActivitySummary(row: ActivityRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mode: row.mode,
    startAt: row.start_at,
    endAt: row.end_at,
    enrollDeadline: row.enroll_deadline,
    targetPoints: row.target_points,
    featured: row.featured === 1,
  };
}

function findPublishedActivity(id: number): ActivityRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, title, description, mode, start_at, end_at, enroll_deadline,
              target_points, status, featured, created_at
       FROM activities
       WHERE id = ? AND status = 'published'`,
    )
    .get(id) as ActivityRow | undefined;
}

function getEnrollment(userId: number, activityId: number) {
  return getDb()
    .prepare(
      `SELECT id, status FROM enrollments
       WHERE user_id = ? AND activity_id = ? AND status = 'enrolled'`,
    )
    .get(userId, activityId) as { id: number; status: string } | undefined;
}

function getProgress(userId: number, activityId: number): number | undefined {
  const row = getDb()
    .prepare(
      `SELECT percent FROM watch_progress WHERE user_id = ? AND activity_id = ?`,
    )
    .get(userId, activityId) as { percent: number } | undefined;
  return row?.percent;
}

export const activitiesRouter = Router();

activitiesRouter.get("/", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, title, description, mode, start_at, end_at, enroll_deadline,
              target_points, status, featured, created_at
       FROM activities
       WHERE status = 'published'
       ORDER BY start_at ASC`,
    )
    .all() as ActivityRow[];

  res.json({ activities: rows.map(toActivitySummary) });
});

activitiesRouter.get("/featured", (req, res) => {
  const limitRaw = req.query.limit;
  const limit = limitRaw === undefined ? 3 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }

  const rows = getDb()
    .prepare(
      `SELECT id, title, description, mode, start_at, end_at, enroll_deadline,
              target_points, status, featured, created_at
       FROM activities
       WHERE status = 'published' AND featured = 1
       ORDER BY start_at ASC
       LIMIT ?`,
    )
    .all(limit) as ActivityRow[];

  res.json({ activities: rows.map(toActivitySummary) });
});

activitiesRouter.get("/:id", optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid activity id" });
    return;
  }

  const activity = findPublishedActivity(id);
  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  const now = Date.now();
  const enrollCheck = canEnrollActivity({
    mode: activity.mode,
    startAt: activity.start_at,
    enrollDeadline: activity.enroll_deadline,
    now,
  });

  const detail: Record<string, unknown> = {
    ...toActivitySummary(activity),
    canEnroll: enrollCheck.ok,
    enrollBlockedReason: enrollCheck.ok ? undefined : enrollCheck.reason,
  };

  const user = req.authUser;
  if (user?.role === "eagle") {
    const enrollment = getEnrollment(user.id, id);
    detail.enrolled = Boolean(enrollment);
    if (activity.mode === "online" && enrollment) {
      detail.progressPercent = getProgress(user.id, id) ?? 0;
    }
  }

  res.json({ activity: detail });
});
