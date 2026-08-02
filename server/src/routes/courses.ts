import { Router } from "express";
import { getDb } from "../connection";

interface CourseRow {
  id: number;
  title: string;
  description: string;
  status: string;
  featured: number;
  created_at: number;
}

function toCourseSummary(row: CourseRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    featured: row.featured === 1,
  };
}

export const coursesRouter = Router();

coursesRouter.get("/", (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT id, title, description, status, featured, created_at
       FROM courses
       WHERE status = 'published'
       ORDER BY created_at ASC`,
    )
    .all() as CourseRow[];

  res.json({ courses: rows.map(toCourseSummary) });
});

coursesRouter.get("/featured", (req, res) => {
  const limitRaw = req.query.limit;
  const limit = limitRaw === undefined ? 3 : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    res.status(400).json({ error: "Invalid limit" });
    return;
  }

  const rows = getDb()
    .prepare(
      `SELECT id, title, description, status, featured, created_at
       FROM courses
       WHERE status = 'published' AND featured = 1
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(limit) as CourseRow[];

  res.json({ courses: rows.map(toCourseSummary) });
});

coursesRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid course id" });
    return;
  }

  const row = getDb()
    .prepare(
      `SELECT id, title, description, status, featured, created_at
       FROM courses
       WHERE id = ? AND status = 'published'`,
    )
    .get(id) as CourseRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  res.json({ course: toCourseSummary(row) });
});
