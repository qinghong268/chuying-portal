import { useCallback, useEffect, useState } from "react";
import type { PermissionCode } from "@chuying/shared";
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

// 可授予普通管理员的权限包（不含 permission）
const ADMIN_PACKAGES: Array<{ code: PermissionCode; name: string }> = [
  { code: "content", name: "内容运营" },
  { code: "join_review", name: "加入审核" },
  { code: "activity", name: "活动管理" },
  { code: "point_type", name: "积分类型" },
  { code: "point_review", name: "积分审批" },
  { code: "user", name: "用户管理" },
  { code: "dashboard", name: "数据看板" },
];

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
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [createPackages, setCreatePackages] = useState<PermissionCode[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  async function createAdmin() {
    const email = createForm.email.trim();
    const displayName = createForm.displayName.trim();
    if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
      setCreateError("请填写合法的邮箱地址。");
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError("密码至少 6 位。");
      return;
    }
    if (!displayName) {
      setCreateError("请填写显示名。");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const res = await api<{ user: AdminUser }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: createForm.password,
          displayName,
          packages: createPackages,
        }),
      });
      setUsers((prev) =>
        [...prev, res.user].sort((a, b) => a.id - b.id),
      );
      setShowCreate(false);
      setCreateForm({ email: "", password: "", displayName: "" });
      setCreatePackages([]);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function removeUser(u: AdminUser) {
    const ok = window.confirm(
      `确认删除账号「${u.displayName}」（${u.email}）？\n删除后不可恢复。`,
    );
    if (!ok) return;

    setActing(u.id);
    setError(null);
    try {
      await api<{ ok: boolean }>(`/api/admin/users/${u.id}`, {
        method: "DELETE",
      });
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(null);
    }
  }

  function toggleCreatePackage(code: PermissionCode) {
    setCreatePackages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>用户管理</h1>
        {me?.role === "super_admin" ? (
          <button
            type="button"
            className={shared.btnAccent}
            onClick={() => {
              setCreateError(null);
              setShowCreate(true);
            }}
          >
            添加管理员
          </button>
        ) : null}
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
                      {me?.role === "super_admin" &&
                      u.id !== me.id &&
                      u.role !== "super_admin" ? (
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={acting === u.id}
                          onClick={() => void removeUser(u)}
                        >
                          删除
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

      {showCreate ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowCreate(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="添加管理员"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={shared.sectionTitle}>添加管理员</h2>
            <div className={shared.formStack}>
              <div className={shared.field}>
                <label htmlFor="new-admin-email">邮箱 *</label>
                <input
                  id="new-admin-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="例如 admin@example.com"
                />
              </div>
              <div className={shared.field}>
                <label htmlFor="new-admin-password">密码（至少 6 位）*</label>
                <input
                  id="new-admin-password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
              </div>
              <div className={shared.field}>
                <label htmlFor="new-admin-name">显示名 *</label>
                <input
                  id="new-admin-name"
                  value={createForm.displayName}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  placeholder="例如 王运营"
                />
              </div>

              <fieldset>
                <legend style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                  权限包
                </legend>
                <div className={styles.grantGrid}>
                  {ADMIN_PACKAGES.map((pkg) => (
                    <div key={pkg.code} className={styles.grantItem}>
                      <input
                        id={`new-admin-pkg-${pkg.code}`}
                        type="checkbox"
                        checked={createPackages.includes(pkg.code)}
                        onChange={() => toggleCreatePackage(pkg.code)}
                      />
                      <label htmlFor={`new-admin-pkg-${pkg.code}`}>
                        <strong>{pkg.name}</strong>
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>

              {createError ? (
                <p className={shared.error}>{createError}</p>
              ) : null}

              <div className={shared.btnRow}>
                <button
                  type="button"
                  className={shared.btnPrimary}
                  disabled={creating}
                  onClick={() => void createAdmin()}
                >
                  {creating ? "创建中…" : "确认"}
                </button>
                <button
                  type="button"
                  className={shared.btnSecondary}
                  disabled={creating}
                  onClick={() => setShowCreate(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
