import { Router } from "express";
import { getDb } from "../connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { canEnrollActivity } from "../domain/enrollment";

interface ActivityRow {
  id: number;
  mode: "online" | "offline";
  start_at: number;
  status: string;
}

export const enrollmentsRouter = Router();

enrollmentsRouter.post(
  "/:id/enroll",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const activityId = Number(req.params.id);
    if (!Number.isInteger(activityId) || activityId < 1) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }

    const activity = getDb()
      .prepare(
        `SELECT id, mode, start_at, status
         FROM activities WHERE id = ? AND status = 'published'`,
      )
      .get(activityId) as ActivityRow | undefined;

    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    const now = Date.now();
    const enrollCheck = canEnrollActivity({
      startAt: activity.start_at,
      now,
    });
    if (!enrollCheck.ok) {
      res.status(403).json({ error: enrollCheck.reason });
      return;
    }

    const userId = req.authUser!.id;
    const existing = getDb()
      .prepare(
        `SELECT id FROM enrollments
         WHERE user_id = ? AND activity_id = ? AND status = 'enrolled'`,
      )
      .get(userId, activityId) as { id: number } | undefined;

    if (existing) {
      res.status(409).json({ error: "Already enrolled" });
      return;
    }

    const result = getDb()
      .prepare(
        `INSERT INTO enrollments (user_id, activity_id, status, enrolled_at)
         VALUES (?, ?, 'enrolled', ?)`,
      )
      .run(userId, activityId, now);

    res.status(201).json({
      enrollment: {
        id: Number(result.lastInsertRowid),
        activityId,
        status: "enrolled",
        enrolledAt: now,
      },
    });
  },
);
