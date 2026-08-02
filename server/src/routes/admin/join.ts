import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface JoinApplicationRow {
  id: number;
  name: string;
  contact: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  created_at: number;
  reviewed_at: number | null;
  reviewer_id: number | null;
  reject_reason: string | null;
}

function toPublic(row: JoinApplicationRow) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewerId: row.reviewer_id,
    rejectReason: row.reject_reason,
  };
}

const rejectSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const adminJoinRouter = Router();

adminJoinRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("join_review"),
);

adminJoinRouter.get("/", (req, res) => {
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  let sql = `SELECT * FROM join_applications WHERE 1=1`;
  const params: Array<string | number> = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (q) {
    sql += ` AND (name LIKE ? OR contact LIKE ? OR message LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ` ORDER BY created_at DESC`;

  const rows = getDb().prepare(sql).all(...params) as JoinApplicationRow[];
  res.json({ applications: rows.map(toPublic) });
});

adminJoinRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM join_applications WHERE id = ?`)
    .get(id) as JoinApplicationRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({ application: toPublic(row) });
});

adminJoinRouter.post("/:id/approve", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM join_applications WHERE id = ?`)
    .get(id) as JoinApplicationRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (row.status !== "pending") {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const now = Date.now();
  const result = getDb()
    .prepare(
      `UPDATE join_applications
       SET status = 'approved',
           reviewer_id = ?,
           reviewed_at = ?,
           reject_reason = NULL
       WHERE id = ? AND status = 'pending'`,
    )
    .run(req.authUser!.id, now, id);

  if (result.changes !== 1) {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const updated = getDb()
    .prepare(`SELECT * FROM join_applications WHERE id = ?`)
    .get(id) as JoinApplicationRow;

  res.json({ application: toPublic(updated) });
});

adminJoinRouter.post("/:id/reject", (req, res) => {
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
    .prepare(`SELECT * FROM join_applications WHERE id = ?`)
    .get(id) as JoinApplicationRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (row.status !== "pending") {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const now = Date.now();
  const result = getDb()
    .prepare(
      `UPDATE join_applications
       SET status = 'rejected',
           reject_reason = ?,
           reviewer_id = ?,
           reviewed_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(parsed.data.reason, req.authUser!.id, now, id);

  if (result.changes !== 1) {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const updated = getDb()
    .prepare(`SELECT * FROM join_applications WHERE id = ?`)
    .get(id) as JoinApplicationRow;

  res.json({ application: toPublic(updated) });
});
