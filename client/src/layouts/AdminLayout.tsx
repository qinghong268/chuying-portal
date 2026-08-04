import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { visibleNavItems, isAdminUser } from "../admin/permissions";
import styles from "./AdminLayout.module.css";

export function AdminLayout() {
  const { user, loading, demoLogin, logout } = useAuth();
  const navItems = visibleNavItems(user);

  return (
    <div className={styles.shell} data-density="admin">
      <header className={styles.topbar}>
        <div className={styles.brand}>雏英计划 · 管理后台</div>
        <div className={styles.actions}>
          {loading ? (
            <span>加载中…</span>
          ) : user ? (
            <span>{user.displayName}</span>
          ) : (
            <>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => void demoLogin("admin")}
              >
                演示管理员
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => void demoLogin("super_admin")}
              >
                演示超管
              </button>
            </>
          )}
          {user ? (
            <button type="button" className={styles.ghostBtn} onClick={() => void logout()}>
              退出
            </button>
          ) : null}
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="后台导航">
          {(loading || isAdminUser(user) ? navItems : []).map((item) => (
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
