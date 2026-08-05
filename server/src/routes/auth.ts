import { Router, type Response } from "express";
import { z } from "zod";
import type { PermissionCode, UserRole } from "@chuying/shared";
import { getDb } from "../connection";
import { hashPassword } from "../lib/password";
import { getUserPermissions } from "../lib/userPermissions";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  requireAuth,
  signAuthToken,
} from "../middleware/auth";

const demoLoginSchema = z.object({
  role: z.enum(["eagle", "admin", "super_admin"]),
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const ROLE_EMAIL: Record<UserRole, string> = {
  eagle: "eagle@demo",
  admin: "admin@demo",
  super_admin: "super@demo",
};

interface UserRow {
  id: number;
  email: string;
  role: UserRole;
  display_name: string;
  status: string;
}

interface UserRowWithPassword extends UserRow {
  password_hash: string;
}

function toPublicUser(row: UserRow) {
  const base = {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    status: row.status,
  };
  if (row.role === "admin" || row.role === "super_admin") {
    return {
      ...base,
      permissions: getUserPermissions(row.id, row.role) as PermissionCode[],
    };
  }
  return base;
}

function findUserByEmail(email: string): UserRowWithPassword | undefined {
  return getDb()
    .prepare(
      `SELECT id, email, role, display_name, status, password_hash
       FROM users WHERE email = ?`,
    )
    .get(email) as UserRowWithPassword | undefined;
}

function findDemoUserByRole(role: UserRole): UserRow | undefined {
  const email = ROLE_EMAIL[role];
  return getDb()
    .prepare(
      `SELECT id, email, role, display_name, status
       FROM users WHERE email = ? AND status = 'active'`,
    )
    .get(email) as UserRow | undefined;
}

function findUserById(id: number): UserRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, email, role, display_name, status
       FROM users WHERE id = ? AND status = 'active'`,
    )
    .get(id) as UserRow | undefined;
}

export const authRouter = Router();

function issueSession(res: Response, user: UserRow): void {
  const token = signAuthToken(user.id, user.role);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  // Record login timestamp
  getDb()
    .prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`)
    .run(Date.now(), user.id);
  res.json({ user: toPublicUser(user) });
}

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid credentials" });
    return;
  }

  const { email, password } = parsed.data;
  const user = findUserByEmail(email);
  if (
    !user ||
    user.status !== "active" ||
    user.password_hash !== hashPassword(password)
  ) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  issueSession(res, user);
});

authRouter.post("/demo-login", (req, res) => {
  const parsed = demoLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const user = findDemoUserByRole(parsed.data.role);
  if (!user) {
    res.status(404).json({ error: "Demo user not found" });
    return;
  }

  issueSession(res, user);
});

authRouter.get("/me", requireAuth, (req, res) => {
  const row = findUserById(req.authUser!.id);
  if (!row) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ user: toPublicUser(row) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: authCookieOptions().secure,
    path: "/",
  });
  res.json({ ok: true });
});
