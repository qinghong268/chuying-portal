import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { UserRole } from "@chuying/shared";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { resolvePostLoginPath } from "../lib/authRedirect";
import shared from "./shared.module.css";
import styles from "./LoginPage.module.css";

const DEMO_ROLES: { role: UserRole; title: string; desc: string }[] = [
  { role: "eagle", title: "雏鹰", desc: "前台个人中心、报名与积分" },
  { role: "admin", title: "管理员", desc: "进入后台控制台" },
  { role: "super_admin", title: "超级管理员", desc: "进入后台控制台" },
];

export function LoginPage() {
  const { user, loading, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect");
  const [busyRole, setBusyRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    navigate(resolvePostLoginPath(user.role, redirect), { replace: true });
  }, [user, loading, navigate, redirect]);

  async function handleDemo(role: UserRole) {
    setBusyRole(role);
    setError(null);
    try {
      const loggedIn = await demoLogin(role);
      navigate(resolvePostLoginPath(loggedIn.role, redirect), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "演示登录失败，请重试");
    } finally {
      setBusyRole(null);
    }
  }

  function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setError("账号密码登录为占位能力，请使用下方演示一键登录。");
  }

  if (loading) {
    return (
      <div className={`${shared.page} ${styles.wrap}`}>
        <p className={shared.muted}>加载中…</p>
      </div>
    );
  }

  return (
    <div className={`${shared.page} ${styles.wrap}`}>
      <div className={styles.grid}>
        <section className={styles.brandPane}>
          <p className={styles.brand}>雏鹰计划</p>
          <h1 className={styles.brandTitle}>SoftTong 人才培养计划门户</h1>
          <ul>
            <li>浏览活动与课程</li>
            <li>报名与积分申请（雏鹰）</li>
            <li>管理后台（管理员）</li>
          </ul>
        </section>

        <section className={`${shared.panel} ${styles.loginPane}`}>
          <h2 className={styles.loginTitle}>登录</h2>
          <p className={shared.muted}>演示环境请使用下方一键角色登录</p>

          <form className={shared.formStack} onSubmit={handlePasswordLogin}>
            <div className={styles.divider}>账号密码（占位）</div>
            <div className={shared.field}>
              <label htmlFor="login-account">账号</label>
              <input
                id="login-account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className={shared.field}>
              <label htmlFor="login-password">密码</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className={shared.btnPrimary}>
              登录
            </button>
          </form>

          <div className={styles.divider}>演示一键登录（主推）</div>
          <div className={styles.roleGrid}>
            {DEMO_ROLES.map((item) => (
              <button
                key={item.role}
                type="button"
                className={styles.roleCard}
                disabled={busyRole !== null}
                onClick={() => void handleDemo(item.role)}
              >
                <strong>{item.title}</strong>
                <span>{item.desc}</span>
                <em>{busyRole === item.role ? "登录中…" : "一键登录"}</em>
              </button>
            ))}
          </div>

          {error ? <p className={shared.error}>{error}</p> : null}

          <p className={styles.joinHint}>
            还不是雏鹰？
            <Link to="/join">申请加入</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
