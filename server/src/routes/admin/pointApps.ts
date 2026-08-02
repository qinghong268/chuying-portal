import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface ApplicationRow {
  id: number;
  user_id: number;
  type: "type1" | "type2";
  activity_id: number | null;
  template_code: string | null;
  payload: string;
  status: "pending" | "approved" | "rejected";
  points_requested: number | null;
  points_granted: number | null;
  reject_reason: string | null;
  reviewer_id: number | null;
  created_at: number;
  reviewed_at: number | null;
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toPublicApplication(row: ApplicationRow) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    activityId: row.activity_id,
    templateCode: row.template_code,
    payload: parsePayload(row.payload),
    status: row.status,
    pointsRequested: row.points_requested,
    pointsGranted: row.points_granted,
    rejectReason: row.reject_reason,
    reviewerId: row.reviewer_id,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

const approveSchema = z.object({
  pointsGranted: z.number().int().min(1).max(9999).optional(),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const adminPointAppsRouter = Router();

adminPointAppsRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("point_review"),
);

adminPointAppsRouter.get("/", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  let sql = `SELECT * FROM point_applications`;
  const params: string[] = [];
  if (status) {
    sql += ` WHERE status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = getDb().prepare(sql).all(...params) as ApplicationRow[];
  res.json({ applications: rows.map(toPublicApplication) });
});

adminPointAppsRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM point_applications WHERE id = ?`)
    .get(id) as ApplicationRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({ application: toPublicApplication(row) });
});

adminPointAppsRouter.post("/:id/approve", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const parsed = approveSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pointsGranted" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM point_applications WHERE id = ?`)
    .get(id) as ApplicationRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (row.status !== "pending") {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const pointsGranted =
    parsed.data.pointsGranted ?? row.points_requested ?? undefined;
  if (
    pointsGranted === undefined ||
    !Number.isInteger(pointsGranted) ||
    pointsGranted < 1 ||
    pointsGranted > 9999
  ) {
    res.status(400).json({ error: "pointsGranted is required" });
    return;
  }

  const reviewerId = req.authUser!.id;
  const now = Date.now();

  const run = getDb().transaction(() => {
    getDb()
      .prepare(
        `UPDATE point_applications
         SET status = 'approved',
             points_granted = ?,
             reviewer_id = ?,
             reviewed_at = ?,
             reject_reason = NULL
         WHERE id = ? AND status = 'pending'`,
      )
      .run(pointsGranted, reviewerId, now, id);

    const updated = getDb()
      .prepare(`SELECT * FROM point_applications WHERE id = ?`)
      .get(id) as ApplicationRow;

    if (updated.status !== "approved") {
      throw new Error("CONFLICT");
    }

    const balanceRow = getDb()
      .prepare(
        `SELECT balance_after FROM point_ledger
         WHERE user_id = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(row.user_id) as { balance_after: number } | undefined;

    const balanceAfter = (balanceRow?.balance_after ?? 0) + pointsGranted;
    const description =
      row.points_requested != null && row.points_requested !== pointsGranted
        ? `积分申请#${id}通过（申请${row.points_requested}→最终${pointsGranted}）`
        : `积分申请#${id}通过`;

    getDb()
      .prepare(
        `INSERT INTO point_ledger
         (user_id, application_id, delta, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.user_id, id, pointsGranted, balanceAfter, description, now);

    return updated;
  });

  try {
    const updated = run();
    res.json({ application: toPublicApplication(updated) });
  } catch (err) {
    if (err instanceof Error && err.message === "CONFLICT") {
      res.status(409).json({ error: "Application already reviewed" });
      return;
    }
    throw err;
  }
});

adminPointAppsRouter.post("/:id/reject", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const parsed = rejectSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Reject reason required (5-500 characters)" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM point_applications WHERE id = ?`)
    .get(id) as ApplicationRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (row.status !== "pending") {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE point_applications
       SET status = 'rejected',
           reject_reason = ?,
           reviewer_id = ?,
           reviewed_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(parsed.data.reason, req.authUser!.id, now, id);

  const updated = getDb()
    .prepare(`SELECT * FROM point_applications WHERE id = ?`)
    .get(id) as ApplicationRow;

  res.json({ application: toPublicApplication(updated) });
});
