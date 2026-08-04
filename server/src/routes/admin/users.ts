import { Router } from "express";
import { z } from "zod";
import { PERMISSION_PACKAGES } from "@chuying/shared";
import { getDb } from "../../connection";
import { hashPassword } from "../../lib/password";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";

// 与项目演示账号约定一致（如 admin@demo），不做 TLD 强校验
const EMAIL = /^[^\s@]+@[^\s@]+$/;

const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(200)
    .refine((v) => EMAIL.test(v), "Email must be a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(200),
  displayName: z.string().trim().min(1, "Display name is required").max(100),
  packages: z.array(z.enum(PERMISSION_PACKAGES)).optional(),
});

interface UserRow {
  id: number;
  email: string;
  role: "eagle" | "admin" | "super_admin";
  display_name: string;
  status: "active" | "disabled";
  created_at: number;
  last_login_at: number | null;
}

function toPublic(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export const adminUsersRouter = Router();

adminUsersRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("user"),
);

adminUsersRouter.get("/", (req, res) => {
  const role = typeof req.query.role === "string" ? req.query.role : undefined;
  const status =
    typeof req.query.status === "string" ? req.query.status : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

  let sql = `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE 1=1`;
  const params: string[] = [];

  if (role) {
    sql += ` AND role = ?`;
    params.push(role);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (q) {
    sql += ` AND (email LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')`;
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    const like = `%${escaped}%`;
    params.push(like, like);
  }
  sql += ` ORDER BY id ASC`;

  const rows = getDb().prepare(sql).all(...params) as UserRow[];
  res.json({ users: rows.map(toPublic) });
});

// PRD 问题三: 仅超管可创建管理员账号
adminUsersRouter.post("/", (req, res) => {
  if (req.authUser!.role !== "super_admin") {
    res.status(403).json({ error: "Only super admin can create admin users" });
    return;
  }

  const parsed = createUserSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.errors[0]?.message ?? "Invalid request body" });
    return;
  }

  const { email, password, displayName, packages = [] } = parsed.data;

  if (packages.includes("permission")) {
    res
      .status(400)
      .json({ error: "Cannot grant permission package to a normal admin" });
    return;
  }

  const existing = getDb()
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .get(email) as { id: number } | undefined;
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const now = Date.now();
  const createUser = getDb().transaction(() => {
    const result = getDb()
      .prepare(
        `INSERT INTO users (email, password_hash, role, display_name, status, created_at)
         VALUES (?, ?, 'admin', ?, 'active', ?)`,
      )
      .run(email, hashPassword(password), displayName, now);
    const userId = Number(result.lastInsertRowid);

    if (packages.length > 0) {
      const insertGrant = getDb().prepare(
        `INSERT INTO admin_grants (user_id, permission_code, granted_at)
         VALUES (?, ?, ?)`,
      );
      for (const code of packages) {
        insertGrant.run(userId, code, now);
      }
    }
    return userId;
  });

  const userId = createUser();
  const user = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(userId) as UserRow;

  res.status(201).json({ user: toPublic(user) });
});

// PRD 问题三: 仅超管可删除管理员/雏英账号
adminUsersRouter.delete("/:id", (req, res) => {
  if (req.authUser!.role !== "super_admin") {
    res.status(403).json({ error: "Only super admin can delete users" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (req.authUser!.id === id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  const user = getDb()
    .prepare(`SELECT id, email, role, status FROM users WHERE id = ?`)
    .get(id) as
    | { id: number; email: string; role: UserRow["role"]; status: string }
    | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "super_admin") {
    const activeSupers = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM users
         WHERE role = 'super_admin' AND status = 'active'`,
      )
      .get() as { c: number };
    if (activeSupers.c <= 1) {
      res.status(400).json({ error: "Cannot delete the last super admin" });
      return;
    }
    res.status(403).json({ error: "Cannot delete a super admin" });
    return;
  }

  getDb().prepare(`DELETE FROM users WHERE id = ?`).run(id);
  res.json({ ok: true });
});

adminUsersRouter.get("/:id/grants", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(id) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const grants = getDb()
    .prepare(
      `SELECT permission_code FROM admin_grants WHERE user_id = ? ORDER BY permission_code`,
    )
    .all(id) as Array<{ permission_code: string }>;

  res.json({
    user: toPublic(user),
    packages: grants.map((g) => g.permission_code),
  });
});

adminUsersRouter.post("/:id/disable", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (req.authUser!.id === id) {
    res.status(400).json({ error: "Cannot disable yourself" });
    return;
  }

  const user = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(id) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "super_admin") {
    // PRD A11: 非超管不可停用超级管理员
    if (req.authUser!.role !== "super_admin") {
      res.status(403).json({ error: "Only super admin can disable a super admin" });
      return;
    }

    const activeSupers = getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM users
         WHERE role = 'super_admin' AND status = 'active'`,
      )
      .get() as { c: number };
    if (activeSupers.c <= 1 && user.status === "active") {
      res.status(400).json({ error: "Cannot disable the last super admin" });
      return;
    }
  }

  getDb()
    .prepare(`UPDATE users SET status = 'disabled' WHERE id = ?`)
    .run(id);

  const updated = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(id) as UserRow;

  res.json({ user: toPublic(updated) });
});

adminUsersRouter.post("/:id/enable", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(id) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Symmetric with disable: non-super-admin cannot enable a super_admin
  if (user.role === "super_admin" && req.authUser!.role !== "super_admin") {
    res.status(403).json({ error: "Only super admin can enable a super admin" });
    return;
  }

  getDb()
    .prepare(`UPDATE users SET status = 'active' WHERE id = ?`)
    .run(id);

  const updated = getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, created_at, last_login_at FROM users WHERE id = ?`,
    )
    .get(id) as UserRow;

  res.json({ user: toPublic(updated) });
});
