import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { roleLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface AdminUser {
  id: number;
  email: string;
  role: "eagle" | "admin" | "super_admin";
  displayName: string;
  status: "active" | "disabled";
  createdAt: number;
  lastLoginAt: number | null;
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [grantsFor, setGrantsFor] = useState<number | null>(null);
  const [grantsData, setGrantsData] = useState<{
    user: AdminUser;
    packages: string[];
  } | null>(null);
  const [grantsLoading, setGrantsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (role) query.set("role", role);
      if (status) query.set("status", status);
      if (q.trim()) query.set("q", q.trim());
      const res = await api<{ users: AdminUser[] }>(
        `/api/admin/users?${query.toString()}`,
      );
      setUsers(res.users);
    } catch {
      setError("用户列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [role, status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadGrants(userId: number) {
    setGrantsFor(userId);
    setGrantsLoading(true);
    try {
      const res = await api<{ user: AdminUser; packages: string[] }>(
        `/api/admin/users/${userId}/grants`,
      );
      setGrantsData(res);
    } catch {
      setError("授权摘要加载失败");
    } finally {
      setGrantsLoading(false);
    }
  }

  function closeGrants() {
    setGrantsFor(null);
    setGrantsData(null);
  }

  async function toggleStatus(u: AdminUser) {
    const disabling = u.status === "active";
    const ok = window.confirm(
      disabling
        ? `确认停用账号「${u.displayName}」（${u.email}）？\n停用后该用户将无法登录及使用需登录功能。`
        : `确认重新启用账号「${u.displayName}」（${u.email}）？`,
    );
    if (!ok) return;

    setActing(u.id);
    setError(null);
    try {
      const path = disabling
        ? `/api/admin/users/${u.id}/disable`
        : `/api/admin/users/${u.id}/enable`;
      const res = await api<{ user: AdminUser }>(path, { method: "POST" });
      setUsers((prev) => prev.map((x) => (x.id === res.user.id ? res.user : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>用户管理</h1>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="user-search">搜索</label>
          <input
            id="user-search"
            type="search"
            placeholder="姓名 / 邮箱"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className={shared.field}>
          <label htmlFor="user-role">角色</label>
          <select id="user-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">全部</option>
            <option value="eagle">雏英</option>
            <option value="admin">管理员</option>
            <option value="super_admin">超级管理员</option>
          </select>
        </div>
        <div className={shared.field}>
          <label htmlFor="user-status">状态</label>
          <select id="user-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="active">正常</option>
            <option value="disabled">已停用</option>
          </select>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>显示名</th>
                <th>邮箱</th>
                <th>角色</th>
                <th>状态</th>
                <th>注册时间</th>
                <th>最近登录</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.status === "active" ? "正常" : "已停用"}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td>
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "从未登录"}
                  </td>
                  <td>
                    <div className={shared.btnRow}>
                      {u.id === me?.id ? (
                        <span className={shared.muted}>当前账号</span>
                      ) : (
                        <button
                          type="button"
                          className={u.status === "active" ? styles.dangerBtn : undefined}
                          disabled={acting === u.id}
                          onClick={() => void toggleStatus(u)}
                        >
                          {u.status === "active" ? "停用" : "启用"}
                        </button>
                      )}
                      {u.role !== "eagle" ? (
                        <button
                          type="button"
                          className={shared.btnGhost}
                          disabled={grantsLoading && grantsFor === u.id}
                          onClick={() =>
                            grantsFor === u.id ? closeGrants() : void loadGrants(u.id)
                          }
                        >
                          {grantsFor === u.id ? "收起授权" : "授权摘要"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {grantsData ? (
        <div className={shared.panel} style={{ marginTop: 16 }}>
          <h3>
            {grantsData.user.displayName}（{grantsData.user.email}）的权限包
          </h3>
          {grantsData.packages.length === 0 ? (
            <p className={shared.muted}>未授予任何权限包</p>
          ) : (
            <ul>
              {grantsData.packages.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
