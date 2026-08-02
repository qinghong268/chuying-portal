import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface ContentBlockRow {
  id: number;
  block_key: string;
  title: string;
  body: string;
  status: "draft" | "published";
  updated_at: number;
}

function toPublic(row: ContentBlockRow) {
  return {
    id: row.id,
    key: row.block_key,
    title: row.title,
    body: row.body,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

const putSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().min(0).max(20000).optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export const adminContentRouter = Router();

adminContentRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("content"),
);

adminContentRouter.get("/blocks", (req, res) => {
  const scope =
    typeof req.query.scope === "string" ? req.query.scope.trim() : undefined;

  let sql = `SELECT * FROM content_blocks`;
  const params: string[] = [];
  if (scope) {
    sql += ` WHERE block_key LIKE ?`;
    params.push(`${scope}%`);
  }
  sql += ` ORDER BY id ASC`;

  const rows = getDb().prepare(sql).all(...params) as ContentBlockRow[];
  res.json({ blocks: rows.map(toPublic) });
});

adminContentRouter.get("/blocks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid block id" });
    return;
  }

  const row = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  res.json({ block: toPublic(row) });
});

adminContentRouter.put("/blocks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid block id" });
    return;
  }

  const parsed = putSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid block update" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  const title = parsed.data.title ?? existing.title;
  const body = parsed.data.body ?? existing.body;
  const status = parsed.data.status ?? existing.status;
  const updatedAt = Date.now();

  getDb()
    .prepare(
      `UPDATE content_blocks
       SET title = ?, body = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(title, body, status, updatedAt, id);

  const updated = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow;

  res.json({ block: toPublic(updated) });
});

adminContentRouter.post("/blocks/:id/publish", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid block id" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  const updatedAt = Date.now();
  getDb()
    .prepare(
      `UPDATE content_blocks SET status = 'published', updated_at = ? WHERE id = ?`,
    )
    .run(updatedAt, id);

  const updated = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow;

  res.json({ block: toPublic(updated) });
});
