import { Router } from "express";
import { getDb } from "../connection";

interface ContentBlockRow {
  block_key: string;
  title: string;
  body: string;
  summary: string | null;
  cover_url: string | null;
  link_url: string | null;
  link_label: string | null;
}

export const contentRouter = Router();

contentRouter.get("/home", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT block_key, title, body, summary, cover_url, link_url, link_label
       FROM content_blocks
       WHERE status = 'published'
       ORDER BY sort_order ASC, id ASC`,
    )
    .all() as ContentBlockRow[];

  res.json({
    blocks: rows.map((row) => ({
      key: row.block_key,
      title: row.title,
      body: row.body,
      summary: row.summary ?? undefined,
      coverUrl: row.cover_url ?? undefined,
      linkUrl: row.link_url ?? undefined,
      linkLabel: row.link_label ?? undefined,
    })),
  });
});

contentRouter.get("/:key", (req, res) => {
  const row = getDb()
    .prepare(
      `SELECT * FROM content_blocks WHERE block_key = ? AND status = 'published'`,
    )
    .get(req.params.key) as ContentBlockRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    block: {
      key: row.block_key,
      title: row.title,
      body: row.body,
      summary: row.summary ?? undefined,
      coverUrl: row.cover_url ?? undefined,
      linkUrl: row.link_url ?? undefined,
      linkLabel: row.link_label ?? undefined,
    },
  });
});
