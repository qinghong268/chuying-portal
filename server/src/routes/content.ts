import { Router } from "express";
import { getDb } from "../connection";

interface ContentBlockRow {
  block_key: string;
  title: string;
  body: string;
}

export const contentRouter = Router();

contentRouter.get("/home", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT block_key, title, body
       FROM content_blocks
       WHERE status = 'published'
       ORDER BY id ASC`,
    )
    .all() as ContentBlockRow[];

  res.json({
    blocks: rows.map((row) => ({
      key: row.block_key,
      title: row.title,
      body: row.body,
    })),
  });
});
