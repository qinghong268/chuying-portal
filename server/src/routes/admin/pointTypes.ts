import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

interface TemplateRow {
  id: number;
  code: string;
  name: string;
  default_points: number;
  enabled: number;
  allow_applicant_edit_points: number;
  created_at: number;
}

function toPublic(row: TemplateRow) {
  return {
    code: row.code,
    name: row.name,
    defaultPoints: row.default_points,
    enabled: Boolean(row.enabled),
    allowApplicantEditPoints: Boolean(row.allow_applicant_edit_points),
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  defaultPoints: z.number().int().positive().max(9999),
});

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultPoints: z.number().int().positive().max(9999).optional(),
  enabled: z.boolean().optional(),
});

export const adminPointTypesRouter = Router();

adminPointTypesRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("point_type"),
);

adminPointTypesRouter.get("/", (_req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM point_type_templates ORDER BY id ASC`)
    .all() as TemplateRow[];
  res.json({ templates: rows.map(toPublic) });
});

adminPointTypesRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid template data" });
    return;
  }

  const { code, name, defaultPoints } = parsed.data;

  const existing = getDb()
    .prepare(`SELECT 1 AS ok FROM point_type_templates WHERE code = ?`)
    .get(code);
  if (existing) {
    res.status(409).json({ error: "Template code already exists" });
    return;
  }

  getDb()
    .prepare(
      `INSERT INTO point_type_templates
         (code, name, default_points, enabled, allow_applicant_edit_points, created_at)
       VALUES (?, ?, ?, 1, 0, ?)`,
    )
    .run(code, name, defaultPoints, Date.now());

  const row = getDb()
    .prepare(`SELECT * FROM point_type_templates WHERE code = ?`)
    .get(code) as TemplateRow;

  res.status(201).json({ template: toPublic(row) });
});

adminPointTypesRouter.delete("/:code", (req, res) => {
  const code = req.params.code;

  const existing = getDb()
    .prepare(`SELECT * FROM point_type_templates WHERE code = ?`)
    .get(code) as TemplateRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const inUse = getDb()
    .prepare(
      `SELECT 1 AS ok FROM point_applications WHERE template_code = ? LIMIT 1`,
    )
    .get(code);
  if (inUse) {
    res.status(409).json({ error: "Cannot delete template in use" });
    return;
  }

  getDb()
    .prepare(`DELETE FROM point_type_templates WHERE code = ?`)
    .run(code);

  res.json({ ok: true });
});

adminPointTypesRouter.patch("/:code", (req, res) => {
  const code = req.params.code;
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid template update" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT * FROM point_type_templates WHERE code = ?`)
    .get(code) as TemplateRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const name = parsed.data.name ?? existing.name;
  const defaultPoints = parsed.data.defaultPoints ?? existing.default_points;
  const enabled =
    parsed.data.enabled === undefined
      ? existing.enabled
      : parsed.data.enabled
        ? 1
        : 0;

  getDb()
    .prepare(
      `UPDATE point_type_templates
       SET name = ?, default_points = ?, enabled = ?
       WHERE code = ?`,
    )
    .run(name, defaultPoints, enabled, code);

  const updated = getDb()
    .prepare(`SELECT * FROM point_type_templates WHERE code = ?`)
    .get(code) as TemplateRow;

  res.json({ template: toPublic(updated) });
});
