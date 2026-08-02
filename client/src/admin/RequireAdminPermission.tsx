import type { PermissionCode } from "@chuying/shared";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import shared from "../pages/shared.module.css";
import { hasPermission, isAdminUser } from "./permissions";
import { NoPermissionPage } from "../pages/admin/NoPermissionPage";

interface Props {
  permission?: PermissionCode;
  children: ReactNode;
}

export function RequireAdminPermission({ permission, children }: Props) {
  const { user, loading, demoLogin } = useAuth();

  if (loading) {
    return <p className={shared.muted}>加载中…</p>;
  }

  if (!user || !isAdminUser(user)) {
    return (
      <div className={shared.panel}>
        <h2 className={shared.pageTitle}>管理后台</h2>
        <p className={shared.lead}>请使用管理员账号登录后访问。</p>
        <div className={shared.btnRow}>
          <button
            type="button"
            className={shared.btnPrimary}
            onClick={() => void demoLogin("admin")}
          >
            演示管理员
          </button>
          <button
            type="button"
            className={shared.btnSecondary}
            onClick={() => void demoLogin("super_admin")}
          >
            演示超级管理员
          </button>
          <Link to="/login" className={shared.btnGhost}>
            前往登录页
          </Link>
        </div>
      </div>
    );
  }

  if (permission && !hasPermission(user, permission)) {
    return <NoPermissionPage />;
  }

  return children;
}
