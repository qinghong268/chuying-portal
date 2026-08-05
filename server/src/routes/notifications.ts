import { Router } from "express";
import { getDb } from "../connection";
import { requireAuth, requireRole } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.get("/me/notifications", requireAuth, requireRole("eagle"), (req, res) => {
  const userId = req.authUser!.id;
  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  // Upcoming activities (enrolled, starts within 3 days)
  const upcoming = getDb().prepare(`
    SELECT a.id, a.title, a.start_at, a.mode FROM activities a
    JOIN enrollments e ON e.activity_id = a.id AND e.user_id = ?
    WHERE a.status = 'published' AND a.start_at > ? AND a.start_at < ?
  `).all(userId, now, now + threeDays);

  // Courses with progress < 99%
  const courses = getDb().prepare(`
    SELECT c.id, c.title, COALESCE(cp.percent, 0) AS progress FROM courses c
    JOIN course_enrollments ce ON ce.course_id = c.id AND ce.user_id = ?
    LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.user_id = ?
    WHERE c.status = 'published' AND COALESCE(cp.percent, 0) < 99
  `).all(userId, userId);

  // Activities ended but no type1 application submitted
  const pendingReflection = getDb().prepare(`
    SELECT a.id, a.title, a.end_at FROM activities a
    JOIN enrollments e ON e.activity_id = a.id AND e.user_id = ? AND e.status = 'enrolled'
    LEFT JOIN point_applications pa ON pa.activity_id = a.id AND pa.user_id = ? AND pa.type = 'type1'
    WHERE a.status = 'published' AND a.end_at < ? AND pa.id IS NULL
  `).all(userId, userId, now);

  // Point application windows closing within 24h
  const closingWindows = getDb().prepare(`
    SELECT a.id, a.title, a.point_apply_deadline FROM activities a
    JOIN enrollments e ON e.activity_id = a.id AND e.user_id = ? AND e.status = 'enrolled'
    WHERE a.status = 'published' AND a.end_at < ? AND a.point_apply_deadline IS NOT NULL
      AND a.point_apply_deadline > ? AND a.point_apply_deadline < ?
  `).all(userId, now, now, now + 86400000);

  res.json({
    upcomingActivities: upcoming,
    inProgressCourses: courses,
    pendingReflections: pendingReflection,
    closingWindows: closingWindows,
  });
});
