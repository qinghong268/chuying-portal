import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import styles from "./PortalLayout.module.css";

const NAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "首页", end: true },
  { to: "/about", label: "计划介绍" },
  { to: "/activities", label: "活动" },
  { to: "/courses", label: "课程" },
  { to: "/join", label: "加入我们" },
];

export function PortalLayout() {
  const { user, loading, demoLogin, logout } = useAuth();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.inner}>
          <NavLink to="/" className={styles.brand} end>
            雏鹰计划
          </NavLink>
          <nav className={styles.nav} aria-label="前台导航">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.linkActive}` : styles.link
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className={styles.actions}>
            {loading ? (
              <span className={styles.muted}>加载中…</span>
            ) : user ? (
              <>
                <span className={styles.user}>{user.displayName}</span>
                <NavLink to="/me" className={styles.link}>
                  个人中心
                </NavLink>
                <button type="button" className={styles.ghostBtn} onClick={() => void logout()}>
                  退出
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={styles.link}>
                  登录
                </NavLink>
                <button
                  type="button"
                  className={styles.accentBtn}
                  onClick={() => void demoLogin("eagle")}
                >
                  演示登录
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.inner}>SoftTong · 雏鹰计划</div>
      </footer>
    </div>
  );
}
