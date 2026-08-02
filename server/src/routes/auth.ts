import { Router } from "express";
import { z } from "zod";
import type { UserRole } from "@chuying/shared";
import { getDb } from "../connection";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  requireAuth,
  signAuthToken,
} from "../middleware/auth";

const demoLoginSchema = z.object({
  role: z.enum(["eagle", "admin", "super_admin"]),
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

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    status: row.status,
  };
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

  const token = signAuthToken(user.id, user.role);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  res.json({ user: toPublicUser(user) });
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
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  res.json({ ok: true });
});
