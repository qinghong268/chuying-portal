import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface CourseRow {
  id: number;
  title: string;
  description: string;
  video_url: string | null;
  cover_url: string | null;
  status: "draft" | "published" | "archived";
  featured: number;
  sort_order: number;
  created_at: number;
}

function toPublic(row: CourseRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    videoUrl: row.video_url ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    status: row.status,
    featured: row.featured === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  videoUrl: z.string().trim().max(2000).nullable().optional(),
  coverUrl: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional().default(false),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const updateSchema = createSchema.partial();

export const adminCoursesRouter = Router();

adminCoursesRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("activity"),
);

adminCoursesRouter.get("/", (req, res) => {
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  let sql = `SELECT * FROM courses WHERE 1=1`;
  const params: Array<string | number> = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (q) {
    sql += ` AND (title LIKE ? OR description LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like);
  }
  sql += ` ORDER BY sort_order ASC, id ASC`;

  const rows = getDb().prepare(sql).all(...params) as CourseRow[];
  res.json({ courses: rows.map(toPublic) });
});

adminCoursesRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid course payload" });
    return;
  }

  const data = parsed.data;
  const now = Date.now();
  const status = data.status ?? "draft";

  const result = getDb()
    .prepare(
      `INSERT INTO courses
       (title, description, video_url, cover_url, status, featured, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.title,
      data.description,
      data.videoUrl ?? null,
      data.coverUrl ?? null,
      status,
      data.featured ? 1 : 0,
      data.sortOrder ?? 0,
      now,
    );

  const row = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as CourseRow;

  res.status(201).json({ course: toPublic(row) });
});

adminCoursesRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json({ course: toPublic(row) });
});

adminCoursesRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid course update" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const data = parsed.data;
  const title = data.title ?? existing.title;
  const description = data.description ?? existing.description;
  const videoUrl =
    data.videoUrl !== undefined ? data.videoUrl ?? null : existing.video_url;
  const coverUrl =
    data.coverUrl !== undefined ? data.coverUrl ?? null : existing.cover_url;
  const status = data.status ?? existing.status;
  const featured =
    data.featured === undefined ? existing.featured : data.featured ? 1 : 0;
  const sortOrder = data.sortOrder ?? existing.sort_order;

  getDb()
    .prepare(
      `UPDATE courses
       SET title = ?, description = ?, video_url = ?, cover_url = ?,
           status = ?, featured = ?, sort_order = ?
       WHERE id = ?`,
    )
    .run(title, description, videoUrl, coverUrl, status, featured, sortOrder, id);

  const updated = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow;

  res.json({ course: toPublic(updated) });
});

adminCoursesRouter.post("/:id/publish", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  getDb()
    .prepare(`UPDATE courses SET status = 'published' WHERE id = ?`)
    .run(id);

  const updated = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow;

  res.json({ course: toPublic(updated) });
});

adminCoursesRouter.post("/:id/unpublish", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  getDb()
    .prepare(`UPDATE courses SET status = 'draft' WHERE id = ?`)
    .run(id);

  const updated = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow;

  res.json({ course: toPublic(updated) });
});

adminCoursesRouter.get("/:id/enrollments", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const course = getDb()
    .prepare(`SELECT * FROM courses WHERE id = ?`)
    .get(id) as CourseRow | undefined;

  if (!course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  const rows = getDb()
    .prepare(
      `SELECT ce.id, ce.user_id, ce.enrolled_at,
              u.email, u.display_name,
              cp.percent AS progress_percent
       FROM course_enrollments ce
       JOIN users u ON u.id = ce.user_id
       LEFT JOIN course_progress cp
         ON cp.user_id = ce.user_id AND cp.course_id = ce.course_id
       WHERE ce.course_id = ?
       ORDER BY ce.enrolled_at DESC`,
    )
    .all(id) as Array<{
    id: number;
    user_id: number;
    enrolled_at: number;
    email: string;
    display_name: string;
    progress_percent: number | null;
  }>;

  res.json({
    course: toPublic(course),
    enrollments: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      enrolledAt: row.enrolled_at,
      progressPercent: row.progress_percent ?? 0,
    })),
  });
});
