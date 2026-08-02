import { Router } from "express";
import { z } from "zod";
import {
  PERMISSION_PACKAGES,
  type PermissionCode,
} from "@chuying/shared";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

const PACKAGE_META: Record<
  PermissionCode,
  { name: string; description: string }
> = {
  content: { name: "内容运营", description: "CMS 编辑与发布" },
  join_review: { name: "加入审核", description: "加入申请通过/驳回" },
  activity: { name: "活动管理", description: "活动 CRUD、报名名单" },
  point_type: { name: "积分类型", description: "模板启用/停用与分值" },
  point_review: { name: "积分审批", description: "申请队列审批" },
  user: { name: "用户管理", description: "账号状态管理" },
  dashboard: { name: "数据看板", description: "关键指标总览" },
  permission: { name: "权限管理", description: "仅超管：授权管理" },
};

const putGrantsSchema = z.object({
  packages: z.array(z.enum(PERMISSION_PACKAGES)),
});

const adminGate = [
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("permission"),
] as const;

export const adminPermissionPackagesRouter = Router();
adminPermissionPackagesRouter.use(...adminGate);

adminPermissionPackagesRouter.get("/", (_req, res) => {
  res.json({
    packages: PERMISSION_PACKAGES.map((code) => ({
      code,
      name: PACKAGE_META[code].name,
      description: PACKAGE_META[code].description,
      grantableToAdmin: code !== "permission",
    })),
  });
});

export const adminGrantsRouter = Router();
adminGrantsRouter.use(...adminGate);

adminGrantsRouter.get("/", (_req, res) => {
  const admins = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at
       FROM users
       WHERE role IN ('admin', 'super_admin')
       ORDER BY role DESC, id ASC`,
    )
    .all() as Array<{
    id: number;
    email: string;
    role: "admin" | "super_admin";
    display_name: string;
    status: string;
    created_at: number;
  }>;

  const grantStmt = getDb().prepare(
    `SELECT permission_code FROM admin_grants WHERE user_id = ? ORDER BY permission_code`,
  );

  res.json({
    admins: admins.map((admin) => {
      const packages =
        admin.role === "super_admin"
          ? [...PERMISSION_PACKAGES]
          : (
              grantStmt.all(admin.id) as Array<{ permission_code: string }>
            ).map((g) => g.permission_code);

      return {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        displayName: admin.display_name,
        status: admin.status,
        createdAt: admin.created_at,
        packages,
        editable: admin.role === "admin",
      };
    }),
  });
});

adminGrantsRouter.put("/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = putGrantsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid packages payload" });
    return;
  }

  const user = getDb()
    .prepare(`SELECT id, role FROM users WHERE id = ?`)
    .get(userId) as { id: number; role: string } | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role !== "admin") {
    res.status(400).json({ error: "Can only update grants for admin users" });
    return;
  }

  const packages = parsed.data.packages as PermissionCode[];
  if (packages.includes("permission")) {
    res.status(400).json({
      error: "Cannot grant permission package to normal admin",
    });
    return;
  }

  const now = Date.now();
  const run = getDb().transaction(() => {
    getDb()
      .prepare(`DELETE FROM admin_grants WHERE user_id = ?`)
      .run(userId);

    const insert = getDb().prepare(
      `INSERT INTO admin_grants (user_id, permission_code, granted_at)
       VALUES (?, ?, ?)`,
    );
    for (const code of packages) {
      insert.run(userId, code, now);
    }
  });

  run();

  res.json({
    userId,
    packages,
  });
});
