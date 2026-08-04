import { Router } from "express";
import { getDb } from "../connection";

interface ContentBlockRow {
  block_key: string;
  title: string;
  body: string;
  cover_url: string | null;
  link_url: string | null;
  link_label: string | null;
}

export const contentRouter = Router();

contentRouter.get("/home", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT block_key, title, body, cover_url, link_url, link_label
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
      coverUrl: row.cover_url ?? undefined,
      linkUrl: row.link_url ?? undefined,
      linkLabel: row.link_label ?? undefined,
    })),
  });
});
