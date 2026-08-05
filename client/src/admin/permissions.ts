import type { PermissionCode } from "@chuying/shared";
import type { AuthUser } from "../auth/AuthContext";

export interface AdminNavItem {
  to: string;
  label: string;
  end?: boolean;
  permission?: PermissionCode;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { to: "/admin", label: "控制台", end: true },
  { to: "/admin/content", label: "内容运营", permission: "content" },
  { to: "/admin/kb", label: "知识库", permission: "content" },
  { to: "/admin/join", label: "加入审核", permission: "join_review" },
  { to: "/admin/activities", label: "活动管理", permission: "activity" },
  { to: "/admin/courses", label: "课程管理", permission: "activity" },
  { to: "/admin/point-types", label: "积分类型", permission: "point_type" },
  { to: "/admin/point-apps", label: "积分审批", permission: "point_review" },
  { to: "/admin/users", label: "用户管理", permission: "user" },
  { to: "/admin/dashboard", label: "数据看板", permission: "dashboard" },
  { to: "/admin/permissions", label: "权限管理", permission: "permission" },
];

export function isAdminUser(user: AuthUser | null): boolean {
  return user?.role === "admin" || user?.role === "super_admin";
}

export function hasPermission(
  user: AuthUser | null,
  code: PermissionCode,
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions?.includes(code) ?? false;
}

export function visibleNavItems(user: AuthUser | null): AdminNavItem[] {
  return ADMIN_NAV.filter(
    (item) => !item.permission || hasPermission(user, item.permission),
  );
}
