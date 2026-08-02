import { Router } from "express";
import { z } from "zod";
import { getDb } from "../connection";
import { requireAuth, requireRole } from "../middleware/auth";

const progressSchema = z.object({
  percent: z.number().min(0).max(100),
});

interface ActivityRow {
  id: number;
  mode: "online" | "offline";
  status: string;
}

export const progressRouter = Router();

progressRouter.put(
  "/:id/progress",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const activityId = Number(req.params.id);
    if (!Number.isInteger(activityId) || activityId < 1) {
      res.status(400).json({ error: "Invalid activity id" });
      return;
    }

    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid progress percent (0-100 required)" });
      return;
    }

    const activity = getDb()
      .prepare(`SELECT id, mode, status FROM activities WHERE id = ? AND status = 'published'`)
      .get(activityId) as ActivityRow | undefined;

    if (!activity) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    if (activity.mode !== "online") {
      res.status(403).json({ error: "Progress tracking is only for online activities" });
      return;
    }

    const userId = req.authUser!.id;
    const enrollment = getDb()
      .prepare(
        `SELECT id FROM enrollments
         WHERE user_id = ? AND activity_id = ? AND status = 'enrolled'`,
      )
      .get(userId, activityId) as { id: number } | undefined;

    if (!enrollment) {
      res.status(403).json({ error: "Not enrolled in this activity" });
      return;
    }

    const now = Date.now();
    const existing = getDb()
      .prepare(
        `SELECT id FROM watch_progress WHERE user_id = ? AND activity_id = ?`,
      )
      .get(userId, activityId) as { id: number } | undefined;

    if (existing) {
      getDb()
        .prepare(
          `UPDATE watch_progress SET percent = ?, updated_at = ? WHERE id = ?`,
        )
        .run(parsed.data.percent, now, existing.id);
    } else {
      getDb()
        .prepare(
          `INSERT INTO watch_progress (user_id, activity_id, percent, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(userId, activityId, parsed.data.percent, now);
    }

    res.json({ progress: { activityId, percent: parsed.data.percent, updatedAt: now } });
  },
);
