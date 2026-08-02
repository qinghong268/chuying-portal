import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import styles from "./AdminLayout.module.css";

const SIDEBAR: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "控制台", end: true },
  { to: "/admin/content", label: "内容运营" },
  { to: "/admin/join", label: "加入审核" },
  { to: "/admin/activities", label: "活动管理" },
  { to: "/admin/point-types", label: "积分类型" },
  { to: "/admin/point-apps", label: "积分审批" },
  { to: "/admin/users", label: "用户管理" },
  { to: "/admin/permissions", label: "权限管理" },
];

export function AdminLayout() {
  const { user, loading, demoLogin, logout } = useAuth();

  return (
    <div className={styles.shell} data-density="admin">
      <header className={styles.topbar}>
        <div className={styles.brand}>雏鹰计划 · 管理后台</div>
        <div className={styles.actions}>
          {loading ? (
            <span>加载中…</span>
          ) : user ? (
            <span>{user.displayName}</span>
          ) : (
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => void demoLogin("admin")}
            >
              演示管理员
            </button>
          )}
          <NavLink to="/" className={styles.topLink}>
            回前台
          </NavLink>
          {user ? (
            <button type="button" className={styles.ghostBtn} onClick={() => void logout()}>
              退出
            </button>
          ) : null}
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="后台导航">
          {SIDEBAR.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.sideLink} ${styles.sideLinkActive}` : styles.sideLink
              }
            >
              {item.label}
            </NavLink>
          ))}
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
