import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@chuying/shared";
import { getDb } from "../connection";

export const AUTH_COOKIE_NAME = "chuying_auth";

export interface AuthJwtPayload {
  sub: number;
  role: UserRole;
}

interface DbUserRow {
  id: number;
  email: string;
  role: UserRole;
  display_name: string;
  status: string;
}

function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not configured");
  }
  return "dev-jwt-secret";
}

export function signAuthToken(userId: number, role: UserRole): string {
  return jwt.sign({ sub: userId, role } satisfies AuthJwtPayload, getJwtSecret(), {
    expiresIn: "7d",
  });
}

export function verifyAuthToken(token: string): AuthJwtPayload {
  const payload = jwt.verify(token, getJwtSecret());
  if (typeof payload === "string" || payload.sub === undefined || payload.role === undefined) {
    throw new Error("Invalid token payload");
  }
  return { sub: Number(payload.sub), role: payload.role as UserRole };
}

export function getTokenFromRequest(req: Request): string | undefined {
  return req.cookies?.[AUTH_COOKIE_NAME] as string | undefined;
}

function loadUserById(id: number): DbUserRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, email, role, display_name, status
       FROM users WHERE id = ?`,
    )
    .get(id) as DbUserRow | undefined;
}

function setAuthUserFromDb(req: Request, user: DbUserRow): void {
  req.authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.display_name,
  };
}

function resolveActiveAuthUser(req: Request): boolean {
  const token = getTokenFromRequest(req);
  if (!token) {
    return false;
  }

  try {
    const payload = verifyAuthToken(token);
    const user = loadUserById(payload.sub);
    if (!user || user.status !== "active") {
      return false;
    }
    setAuthUserFromDb(req, user);
    return true;
  } catch {
    return false;
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  resolveActiveAuthUser(req);
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!resolveActiveAuthUser(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function authCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  // COOKIE_SECURE=true|false 显式控制；未设置时 HTTPS 环境或生产才 Secure
  const secure = process.env.COOKIE_SECURE === "true" ? true
    : process.env.COOKIE_SECURE === "false" ? false
    : isProd;
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
