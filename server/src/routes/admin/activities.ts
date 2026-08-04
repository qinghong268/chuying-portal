import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface ActivityRow {
  id: number;
  title: string;
  description: string;
  mode: "online" | "offline";
  start_at: number;
  end_at: number;
  enroll_deadline: number;
  point_apply_deadline: number | null;
  target_points: number;
  status: "draft" | "published" | "archived";
  featured: number;
  video_url: string | null;
  image_url: string | null;
  created_at: number;
}

function toPublic(row: ActivityRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mode: row.mode,
    startAt: row.start_at,
    endAt: row.end_at,
    enrollDeadline: row.enroll_deadline,
    pointApplyDeadline: row.point_apply_deadline,
    targetPoints: row.target_points,
    status: row.status,
    featured: row.featured === 1,
    videoUrl: row.video_url ?? undefined,
    imageUrl: row.image_url ?? undefined,
    createdAt: row.created_at,
  };
}

function publishRequiresPointApplyDeadline(
  status: "draft" | "published" | "archived",
  pointApplyDeadline: number | null | undefined,
): boolean {
  return status === "published" && pointApplyDeadline == null;
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  mode: z.enum(["online", "offline"]),
  startAt: z.number().int().positive(),
  endAt: z.number().int().positive(),
  pointApplyDeadline: z.number().int().positive().nullable().optional(),
  targetPoints: z.number().int().min(0).max(9999).default(0),
  videoUrl: z.string().trim().max(2000).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  featured: z.boolean().optional().default(false),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const updateSchema = createSchema.partial();

export const adminActivitiesRouter = Router();

adminActivitiesRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("activity"),
);

adminActivitiesRouter.get("/", (req, res) => {
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const mode = typeof req.query.mode === "string" ? req.query.mode : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  let sql = `SELECT * FROM activities WHERE 1=1`;
  const params: Array<string | number> = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (mode) {
    sql += ` AND mode = ?`;
    params.push(mode);
  }
  if (q) {
    sql += ` AND (title LIKE ? OR description LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = getDb().prepare(sql).all(...params) as ActivityRow[];
  res.json({ activities: rows.map(toPublic) });
});

adminActivitiesRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity payload" });
    return;
  }

  const data = parsed.data;
  if (data.endAt < data.startAt) {
    res.status(400).json({ error: "endAt must be >= startAt" });
    return;
  }

  const now = Date.now();
  const status = data.status ?? "draft";
  const pointApplyDeadline = data.pointApplyDeadline ?? null;

  if (publishRequiresPointApplyDeadline(status, pointApplyDeadline)) {
    res.status(400).json({ error: "pointApplyDeadline is required to publish" });
    return;
  }

  const result = getDb()
    .prepare(
      `INSERT INTO activities
       (title, description, mode, start_at, end_at, enroll_deadline,
        point_apply_deadline, target_points, video_url, image_url, status, featured, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.title,
      data.description,
      data.mode,
      data.startAt,
      data.endAt,
      data.startAt,
      pointApplyDeadline,
      data.targetPoints,
      data.videoUrl ?? null,
      data.imageUrl ?? null,
      status,
      data.featured ? 1 : 0,
      now,
    );

  const row = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as ActivityRow;

  res.status(201).json({ activity: toPublic(row) });
});

adminActivitiesRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid activity id" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  res.json({ activity: toPublic(row) });
});

adminActivitiesRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid activity id" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid activity update" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  const data = parsed.data;
  const title = data.title ?? existing.title;
  const description = data.description ?? existing.description;
  const mode = data.mode ?? existing.mode;
  const startAt = data.startAt ?? existing.start_at;
  const endAt = data.endAt ?? existing.end_at;
  const pointApplyDeadline =
    data.pointApplyDeadline !== undefined
      ? data.pointApplyDeadline
      : existing.point_apply_deadline;
  const targetPoints = data.targetPoints ?? existing.target_points;
  const videoUrl =
    data.videoUrl !== undefined ? data.videoUrl ?? null : existing.video_url;
  const imageUrl =
    data.imageUrl !== undefined ? data.imageUrl ?? null : existing.image_url;
  const status = data.status ?? existing.status;
  const featured =
    data.featured === undefined ? existing.featured : data.featured ? 1 : 0;

  if (endAt < startAt) {
    res.status(400).json({ error: "endAt must be >= startAt" });
    return;
  }

  if (publishRequiresPointApplyDeadline(status, pointApplyDeadline)) {
    res.status(400).json({ error: "pointApplyDeadline is required to publish" });
    return;
  }

  getDb()
    .prepare(
      `UPDATE activities
       SET title = ?, description = ?, mode = ?, start_at = ?, end_at = ?,
           enroll_deadline = ?, point_apply_deadline = ?, target_points = ?,
           video_url = ?, image_url = ?, status = ?, featured = ?
       WHERE id = ?`,
    )
    .run(
      title,
      description,
      mode,
      startAt,
      endAt,
      startAt,
      pointApplyDeadline,
      targetPoints,
      videoUrl,
      imageUrl,
      status,
      featured,
      id,
    );

  const updated = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow;

  res.json({ activity: toPublic(updated) });
});

adminActivitiesRouter.post("/:id/publish", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid activity id" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  if (existing.point_apply_deadline == null) {
    res.status(400).json({ error: "pointApplyDeadline is required to publish" });
    return;
  }

  getDb()
    .prepare(
      `UPDATE activities SET status = 'published', enroll_deadline = start_at WHERE id = ?`,
    )
    .run(id);

  const updated = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow;

  res.json({ activity: toPublic(updated) });
});

adminActivitiesRouter.post("/:id/unpublish", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid activity id" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  getDb()
    .prepare(`UPDATE activities SET status = 'draft' WHERE id = ?`)
    .run(id);

  const updated = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow;

  res.json({ activity: toPublic(updated) });
});

adminActivitiesRouter.get("/:id/enrollments", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid activity id" });
    return;
  }

  const activity = getDb()
    .prepare(`SELECT * FROM activities WHERE id = ?`)
    .get(id) as ActivityRow | undefined;

  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  const rows = getDb()
    .prepare(
      `SELECT e.id, e.user_id, e.status, e.enrolled_at,
              u.email, u.display_name,
              wp.percent AS watch_percent
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN watch_progress wp
         ON wp.user_id = e.user_id AND wp.activity_id = e.activity_id
       WHERE e.activity_id = ?
       ORDER BY e.enrolled_at DESC`,
    )
    .all(id) as Array<{
    id: number;
    user_id: number;
    status: string;
    enrolled_at: number;
    email: string;
    display_name: string;
    watch_percent: number | null;
  }>;

  res.json({
    activity: toPublic(activity),
    enrollments: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      enrolledAt: row.enrolled_at,
      watchPercent:
        activity.mode === "online" ? (row.watch_percent ?? 0) : undefined,
    })),
  });
});
