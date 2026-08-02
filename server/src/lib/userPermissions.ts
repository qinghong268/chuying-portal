import {
  PERMISSION_PACKAGES,
  type PermissionCode,
  type UserRole,
} from "@chuying/shared";
import { getDb } from "../connection";

export function getUserPermissions(
  userId: number,
  role: UserRole,
): PermissionCode[] {
  if (role === "super_admin") {
    return [...PERMISSION_PACKAGES];
  }
  if (role === "admin") {
    const grants = getDb()
      .prepare(
        `SELECT permission_code FROM admin_grants WHERE user_id = ? ORDER BY permission_code`,
      )
      .all(userId) as Array<{ permission_code: string }>;
    return grants.map((g) => g.permission_code as PermissionCode);
  }
  return [];
}
