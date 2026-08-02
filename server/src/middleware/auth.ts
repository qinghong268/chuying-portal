import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@chuying/shared";

export const AUTH_COOKIE_NAME = "chuying_auth";

export interface AuthJwtPayload {
  sub: number;
  role: UserRole;
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

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.authUser = {
      id: payload.sub,
      email: "",
      role: payload.role,
      displayName: "",
    };
  } catch {
    // Invalid token — treat as guest
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    req.authUser = {
      id: payload.sub,
      email: "",
      role: payload.role,
      displayName: "",
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
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
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
