import type { Request, Response, NextFunction } from "express";
import type { PermissionCode } from "@chuying/shared";
import { getDb } from "../connection";

export function requirePermission(code: PermissionCode) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.authUser.role === "super_admin") {
      next();
      return;
    }

    if (req.authUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const grant = getDb()
      .prepare(
        `SELECT 1 AS ok FROM admin_grants
         WHERE user_id = ? AND permission_code = ?`,
      )
      .get(req.authUser.id, code) as { ok: number } | undefined;

    if (!grant) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
