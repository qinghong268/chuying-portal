import type { PermissionCode } from "@chuying/shared";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import shared from "../pages/shared.module.css";
import { hasPermission, isAdminUser } from "./permissions";
import { NoPermissionPage } from "../pages/admin/NoPermissionPage";

interface Props {
  permission?: PermissionCode;
  children: ReactNode;
}

export function RequireAdminPermission({ permission, children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className={shared.muted}>加载中…</p>;
  }

  // PRD §6: 访客访问管理端 → 跳转 /login?redirect=
  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // PRD §6: 雏英访问管理端 → 拒绝，提示无权限（不暴露管理员入口）
  if (!isAdminUser(user)) {
    return <NoPermissionPage />;
  }

  if (permission && !hasPermission(user, permission)) {
    return <NoPermissionPage />;
  }

  return children;
}
