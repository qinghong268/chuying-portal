import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface KbDocumentRow {
  id: number;
  title: string;
  content: string;
  created_at: number;
  updated_at: number;
}

function toSummary(row: KbDocumentRow) {
  return { id: row.id, title: row.title, updatedAt: row.updated_at };
}

function toDocument(row: KbDocumentRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().min(0).max(100000).optional(),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  content: z.string().min(0).max(100000).optional(),
});

export const adminKbRouter = Router();

adminKbRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("content"),
);

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

adminKbRouter.get("/", (req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, title, content, created_at, updated_at
       FROM kb_documents ORDER BY updated_at DESC, id DESC`,
    )
    .all() as KbDocumentRow[];
  res.json({ documents: rows.map(toSummary) });
});

adminKbRouter.get("/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  const row = getDb()
    .prepare(
      `SELECT id, title, content, created_at, updated_at
       FROM kb_documents WHERE id = ?`,
    )
    .get(id) as KbDocumentRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json({ document: toDocument(row) });
});

adminKbRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document" });
    return;
  }

  const now = Date.now();
  const info = getDb()
    .prepare(
      `INSERT INTO kb_documents (title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(parsed.data.title, parsed.data.content ?? "", now, now);

  const row = getDb()
    .prepare(
      `SELECT id, title, content, created_at, updated_at
       FROM kb_documents WHERE id = ?`,
    )
    .get(Number(info.lastInsertRowid)) as KbDocumentRow;

  res.status(201).json({ document: toDocument(row) });
});

adminKbRouter.put("/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document update" });
    return;
  }

  const existing = getDb()
    .prepare(
      `SELECT id, title, content, created_at, updated_at
       FROM kb_documents WHERE id = ?`,
    )
    .get(id) as KbDocumentRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const nextTitle = parsed.data.title ?? existing.title;
  const nextContent = parsed.data.content ?? existing.content;

  getDb()
    .prepare(
      `UPDATE kb_documents SET title = ?, content = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(nextTitle, nextContent, Date.now(), id);

  const updated = getDb()
    .prepare(
      `SELECT id, title, content, created_at, updated_at
       FROM kb_documents WHERE id = ?`,
    )
    .get(id) as KbDocumentRow;

  res.json({ document: toDocument(updated) });
});

adminKbRouter.delete("/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  const exists = getDb()
    .prepare(`SELECT id FROM kb_documents WHERE id = ?`)
    .get(id);
  if (!exists) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  getDb().prepare(`DELETE FROM kb_documents WHERE id = ?`).run(id);
  res.json({ ok: true });
});
