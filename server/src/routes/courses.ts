import { Router } from "express";
import { z } from "zod";
import { getDb } from "../connection";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";

interface CourseRow {
  id: number;
  title: string;
  description: string;
  video_url: string | null;
  cover_url: string | null;
  status: string;
  featured: number;
  sort_order: number;
  created_at: number;
}

function toCourseSummary(row: CourseRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    featured: row.featured === 1,
  };
}

function findPublishedCourse(id: number): CourseRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, title, description, video_url, cover_url, status, featured, sort_order, created_at
       FROM courses
       WHERE id = ? AND status = 'published'`,
    )
    .get(id) as CourseRow | undefined;
}

function getEnrollment(userId: number, courseId: number) {
  return getDb()
    .prepare(
      `SELECT id FROM course_enrollments
       WHERE user_id = ? AND course_id = ?`,
    )
    .get(userId, courseId) as { id: number } | undefined;
}

function getProgress(userId: number, courseId: number): number | undefined {
  const row = getDb()
    .prepare(
      `SELECT percent FROM course_progress WHERE user_id = ? AND course_id = ?`,
    )
    .get(userId, courseId) as { percent: number } | undefined;
  return row?.percent;
}

const progressSchema = z.object({
  percent: z.number().min(0).max(100),
});

export const coursesRouter = Router();

coursesRouter.get("/", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, title, description, video_url, cover_url, status, featured, sort_order, created_at
       FROM courses
       WHERE status = 'published'
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as CourseRow[];

  res.json({ courses: rows.map(toCourseSummary) });
});

coursesRouter.get("/featured", (req, res) => {
  const limitRaw = req.query.limit;
  const limit = limitRaw === undefined ? 3 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }

  const rows = getDb()
    .prepare(
      `SELECT id, title, description, video_url, cover_url, status, featured, sort_order, created_at
       FROM courses
       WHERE status = 'published' AND featured = 1
       ORDER BY sort_order ASC, id ASC
       LIMIT ?`,
    )
    .all(limit) as CourseRow[];

  res.json({ courses: rows.map(toCourseSummary) });
});

coursesRouter.get("/:id", optionalAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const course = findPublishedCourse(id);
  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const detail: Record<string, unknown> = { ...toCourseSummary(course) };

  const user = req.authUser;
  if (user?.role === "eagle") {
    const enrolled = Boolean(getEnrollment(user.id, id));
    detail.enrolled = enrolled;
    if (enrolled) {
      detail.progressPercent = getProgress(user.id, id) ?? 0;
    }
  }

  res.json({ course: detail });
});

coursesRouter.post(
  "/:id/enroll",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId < 1) {
      res.status(400).json({ error: "Invalid course id" });
      return;
    }

    const course = findPublishedCourse(courseId);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const userId = req.authUser!.id;
    const existing = getEnrollment(userId, courseId);
    if (existing) {
      res.status(409).json({ error: "Already enrolled" });
      return;
    }

    const now = Date.now();
    const result = getDb()
      .prepare(
        `INSERT INTO course_enrollments (user_id, course_id, enrolled_at)
         VALUES (?, ?, ?)`,
      )
      .run(userId, courseId, now);

    res.status(201).json({
      enrollment: {
        id: Number(result.lastInsertRowid),
        courseId,
        enrolledAt: now,
      },
    });
  },
);

coursesRouter.put(
  "/:id/progress",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId < 1) {
      res.status(400).json({ error: "Invalid course id" });
      return;
    }

    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid progress percent (0-100 required)" });
      return;
    }

    const course = findPublishedCourse(courseId);
    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const userId = req.authUser!.id;
    const enrollment = getEnrollment(userId, courseId);
    if (!enrollment) {
      res.status(403).json({ error: "Not enrolled in this course" });
      return;
    }

    const now = Date.now();
    const existing = getDb()
      .prepare(
        `SELECT id FROM course_progress WHERE user_id = ? AND course_id = ?`,
      )
      .get(userId, courseId) as { id: number } | undefined;

    if (existing) {
      getDb()
        .prepare(
          `UPDATE course_progress SET percent = ?, updated_at = ? WHERE id = ?`,
        )
        .run(parsed.data.percent, now, existing.id);
    } else {
      getDb()
        .prepare(
          `INSERT INTO course_progress (user_id, course_id, percent, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(userId, courseId, parsed.data.percent, now);
    }

    res.json({
      progress: { courseId, percent: parsed.data.percent, updatedAt: now },
    });
  },
);

coursesRouter.get(
  "/:id/my-progress",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const courseId = Number(req.params.id);
    if (!Number.isInteger(courseId) || courseId < 1) {
      res.status(400).json({ error: "Invalid course id" });
      return;
    }

    const userId = req.authUser!.id;
    const enrollment = getEnrollment(userId, courseId);
    if (!enrollment) {
      res.status(403).json({ error: "Not enrolled in this course" });
      return;
    }

    const row = getDb()
      .prepare(
        `SELECT percent, updated_at FROM course_progress WHERE user_id = ? AND course_id = ?`,
      )
      .get(userId, courseId) as
      | { percent: number; updated_at: number }
      | undefined;

    res.json({
      progress: {
        courseId,
        percent: row?.percent ?? 0,
        updatedAt: row?.updated_at ?? null,
      },
    });
  },
);
