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
  draft_title: string | null;
  draft_body: string | null;
  status: "draft" | "published";
  updated_at: number;
  summary: string | null;
  cover_url: string | null;
  link_url: string | null;
  link_label: string | null;
  sort_order: number;
}

function draftTitle(row: ContentBlockRow): string {
  return row.draft_title ?? row.title;
}

function draftBody(row: ContentBlockRow): string {
  return row.draft_body ?? row.body;
}

function toAdminBlock(row: ContentBlockRow) {
  return {
    id: row.id,
    key: row.block_key,
    title: draftTitle(row),
    body: draftBody(row),
    status: row.status,
    updatedAt: row.updated_at,
    summary: row.summary ?? undefined,
    coverUrl: row.cover_url ?? undefined,
    linkUrl: row.link_url ?? undefined,
    linkLabel: row.link_label ?? undefined,
    sortOrder: row.sort_order,
  };
}

const putSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().min(0).max(500).optional(),
  body: z.string().min(0).max(20000).optional(),
  status: z.enum(["draft", "published"]).optional(),
  cover_url: z.string().max(2000).optional(),
  coverUrl: z.string().max(2000).optional(),
  link_url: z.string().max(2000).optional(),
  linkUrl: z.string().max(2000).optional(),
  link_label: z.string().max(100).optional(),
  linkLabel: z.string().max(100).optional(),
  sort_order: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const createSchema = z.object({
  block_key: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  summary: z.string().min(0).max(500).optional(),
  body: z.string().min(0).max(20000).optional(),
  cover_url: z.string().max(2000).optional(),
  coverUrl: z.string().max(2000).optional(),
  link_url: z.string().max(2000).optional(),
  linkUrl: z.string().max(2000).optional(),
  link_label: z.string().max(100).optional(),
  linkLabel: z.string().max(100).optional(),
});

const sortSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sort_order: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(1000),
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
  sql += ` ORDER BY sort_order ASC, id ASC`;

  const rows = getDb().prepare(sql).all(...params) as ContentBlockRow[];
  res.json({ blocks: rows.map(toAdminBlock) });
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

  res.json({ block: toAdminBlock(row) });
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

  const nextDraftTitle =
    parsed.data.title !== undefined ? parsed.data.title : draftTitle(existing);
  const nextDraftBody =
    parsed.data.body !== undefined ? parsed.data.body : draftBody(existing);
  const nextSummary =
    parsed.data.summary !== undefined
      ? parsed.data.summary.trim() || null
      : existing.summary;
  // A02: PUT never demotes published→draft and never promotes (only POST .../publish).
  let status = existing.status;
  if (
    existing.status !== "published" &&
    parsed.data.status !== undefined &&
    parsed.data.status !== "published"
  ) {
    status = parsed.data.status;
  }

  const coverUrlInput =
    parsed.data.cover_url !== undefined ? parsed.data.cover_url : parsed.data.coverUrl;
  const linkUrlInput =
    parsed.data.link_url !== undefined ? parsed.data.link_url : parsed.data.linkUrl;
  const linkLabelInput =
    parsed.data.link_label !== undefined
      ? parsed.data.link_label
      : parsed.data.linkLabel;
  const sortOrderInput =
    parsed.data.sort_order !== undefined ? parsed.data.sort_order : parsed.data.sortOrder;

  // Empty string clears the field (stored as NULL); undefined keeps the existing value.
  const nextCoverUrl =
    coverUrlInput !== undefined ? coverUrlInput.trim() || null : existing.cover_url;
  const nextLinkUrl =
    linkUrlInput !== undefined ? linkUrlInput.trim() || null : existing.link_url;
  const nextLinkLabel =
    linkLabelInput !== undefined ? linkLabelInput.trim() || null : existing.link_label;
  const nextSortOrder =
    sortOrderInput !== undefined ? sortOrderInput : existing.sort_order;

  const updatedAt = Date.now();

  getDb()
    .prepare(
      `UPDATE content_blocks
       SET draft_title = ?, draft_body = ?, status = ?, updated_at = ?,
           summary = ?, cover_url = ?, link_url = ?, link_label = ?, sort_order = ?
       WHERE id = ?`,
    )
    .run(
      nextDraftTitle,
      nextDraftBody,
      status,
      updatedAt,
      nextSummary,
      nextCoverUrl,
      nextLinkUrl,
      nextLinkLabel,
      nextSortOrder,
      id,
    );

  const updated = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow;

  res.json({ block: toAdminBlock(updated) });
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

  const publishedTitle = draftTitle(existing);
  const publishedBody = draftBody(existing);
  const updatedAt = Date.now();

  getDb()
    .prepare(
      `UPDATE content_blocks
       SET title = ?, body = ?, draft_title = ?, draft_body = ?,
           status = 'published', updated_at = ?
       WHERE id = ?`,
    )
    .run(
      publishedTitle,
      publishedBody,
      publishedTitle,
      publishedBody,
      updatedAt,
      id,
    );

  const updated = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(id) as ContentBlockRow;

  res.json({ block: toAdminBlock(updated) });
});

adminContentRouter.post("/blocks", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid block" });
    return;
  }

  const { block_key, title, summary, body, cover_url, coverUrl, link_url, linkUrl, link_label, linkLabel } = parsed.data;
  const cover = cover_url ?? coverUrl ?? null;
  const link = link_url ?? linkUrl ?? null;
  const label = link_label ?? linkLabel ?? null;
  const exists = getDb()
    .prepare(`SELECT id FROM content_blocks WHERE block_key = ?`)
    .get(block_key);
  if (exists) {
    res.status(409).json({ error: "Block key already exists" });
    return;
  }

  const maxRow = getDb()
    .prepare(`SELECT MAX(sort_order) AS m FROM content_blocks`)
    .get() as { m: number | null };
  const sortOrder = (maxRow.m ?? -1) + 1;
  const now = Date.now();
  const nextBody = body ?? "";

  const info = getDb()
    .prepare(
      `INSERT INTO content_blocks
         (block_key, title, body, draft_title, draft_body, summary, cover_url, link_url, link_label, status, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    )
    .run(block_key, title, nextBody, title, nextBody, summary?.trim() || null, cover, link, label, sortOrder, now);

  const row = getDb()
    .prepare(`SELECT * FROM content_blocks WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as ContentBlockRow;

  res.status(201).json({ block: toAdminBlock(row) });
});

adminContentRouter.delete("/blocks/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid block id" });
    return;
  }

  const exists = getDb()
    .prepare(`SELECT id FROM content_blocks WHERE id = ?`)
    .get(id);
  if (!exists) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  getDb().prepare(`DELETE FROM content_blocks WHERE id = ?`).run(id);
  res.json({ ok: true });
});

adminContentRouter.patch("/blocks/sort", (req, res) => {
  const parsed = sortSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid sort payload" });
    return;
  }

  const run = getDb().transaction(() => {
    const stmt = getDb().prepare(
      `UPDATE content_blocks SET sort_order = ? WHERE id = ?`,
    );
    for (const order of parsed.data.orders) {
      stmt.run(order.sort_order, order.id);
    }
  });
  run();

  res.json({ ok: true });
});

// POST /blocks/ai-draft - Generate AI content draft
adminContentRouter.post("/blocks/ai-draft", async (req, res) => {
  const { topic } = req.body;
  if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
    res.status(400).json({ error: "请输入内容主题" });
    return;
  }

  try {
    const { deepseekChat } = await import("../../lib/deepseek");
    const response = await deepseekChat([
      { role: "system", content: `你是雏英计划的内容运营编辑。根据给定的主题，生成适合官网宣传的内容块。必须以JSON格式返回：{"title":"标题","summary":"简介(≤100字)","body":"<h2>标题</h2><p>段落</p><ul><li>要点</li></ul>"}。简介简洁有力，正文使用HTML标签排版（h2/p/ul/li/strong），200-500字。` },
      { role: "user", content: topic }
    ], { temperature: 0.7, maxTokens: 800 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response");
    const draft = JSON.parse(jsonMatch[0]);

    res.json({
      title: draft.title || "",
      summary: draft.summary || "",
      body: draft.body || "",
    });
  } catch (err) {
    console.error("AI draft error:", err);
    res.status(502).json({ error: "AI内容生成失败，请稍后重试" });
  }
});
