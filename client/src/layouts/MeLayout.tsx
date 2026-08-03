import { NavLink, Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import { useRequireEagle } from "../hooks/useRequireEagle";
import shared from "../pages/shared.module.css";
import styles from "./MeLayout.module.css";

const SUBNAV: { to: string; label: string; end?: boolean }[] = [
  { to: "/me", label: "概览", end: true },
  { to: "/me/enrollments", label: "我的报名" },
  { to: "/me/applications", label: "我的申请" },
  { to: "/me/points", label: "积分明细" },
];

export function MeLayout() {
  const { user, loading, isEagle } = useRequireEagle();

  if (loading || !user) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.muted}>加载中…</p>
      </div>
    );
  }

  if (!isEagle) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <div className={styles.denied}>
          <h1 className={styles.title}>个人中心</h1>
          <p>当前账号无雏英个人中心权限，请使用雏英演示账号登录。</p>
          <div className={shared.btnRow}>
            <Link to="/" className={shared.btnSecondary}>
              返回首页
            </Link>
            <Link to="/login" className={shared.btnPrimary}>
              切换账号
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${shared.page} ${shared.container} ${styles.wrap}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>个人中心</h1>
        <nav className={styles.subnav} aria-label="个人中心子导航">
          {SUBNAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.subnavLink} ${styles.subnavActive}` : styles.subnavLink
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
