import { Router } from "express";
import { getDb } from "../connection";

interface TemplateRow {
  code: string;
  name: string;
  default_points: number;
  enabled: number;
}

export const pointTemplatesRouter = Router();

pointTemplatesRouter.get("/", (req, res) => {
  const enabledOnly =
    req.query.enabled === "true" || req.query.enabled === "1";

  const rows = (
    enabledOnly
      ? getDb()
          .prepare(
            `SELECT code, name, default_points, enabled
             FROM point_type_templates WHERE enabled = 1 ORDER BY id ASC`,
          )
          .all()
      : getDb()
          .prepare(
            `SELECT code, name, default_points, enabled
             FROM point_type_templates ORDER BY id ASC`,
          )
          .all()
  ) as TemplateRow[];

  res.json({
    templates: rows.map((row) => ({
      code: row.code,
      name: row.name,
      defaultPoints: row.default_points,
      enabled: Boolean(row.enabled),
    })),
  });
});
