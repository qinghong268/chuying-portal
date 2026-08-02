import { useCallback, useEffect, useState } from "react";
import type { PermissionCode } from "@chuying/shared";
import { api } from "../../api/client";
import { roleLabel } from "../../lib/adminLabels";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface PackageMeta {
  code: PermissionCode;
  name: string;
  description: string;
  grantableToAdmin: boolean;
}

interface AdminGrantRow {
  id: number;
  email: string;
  role: "admin" | "super_admin";
  displayName: string;
  status: string;
  packages: PermissionCode[];
  editable: boolean;
}

export function PermissionsPage() {
  const [packages, setPackages] = useState<PackageMeta[]>([]);
  const [admins, setAdmins] = useState<AdminGrantRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PermissionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = admins.find((a) => a.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgRes, grantRes] = await Promise.all([
        api<{ packages: PackageMeta[] }>("/api/admin/permission-packages"),
        api<{ admins: AdminGrantRow[] }>("/api/admin/admin-grants"),
      ]);
      setPackages(pkgRes.packages);
      setAdmins(grantRes.admins);
      setSelectedId((prev) => {
        if (prev !== null) return prev;
        const firstEditable = grantRes.admins.find((a) => a.editable);
        return firstEditable?.id ?? null;
      });
    } catch {
      setError("权限数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected?.editable) {
      setDraft([...selected.packages]);
    }
  }, [selected?.id, selected?.packages]);

  function togglePackage(code: PermissionCode) {
    const meta = packages.find((p) => p.code === code);
    if (!meta?.grantableToAdmin) return;
    setDraft((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function saveGrants() {
    if (!selectedId || !selected?.editable) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/admin/admin-grants/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ packages: draft }),
      });
      setMessage("权限已更新");
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>权限管理</h1>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {message ? <p className={shared.muted}>{message}</p> : null}

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : (
        <div className={styles.grid2}>
          <div className={shared.panel}>
            <h2 className={shared.sectionTitle}>管理员账号</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>账号</th>
                    <th>角色</th>
                    <th>权限数</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr
                      key={admin.id}
                      style={{
                        cursor: admin.editable ? "pointer" : "default",
                        background:
                          admin.id === selectedId ? "rgba(13,148,136,0.06)" : undefined,
                      }}
                      onClick={() => {
                        if (admin.editable) {
                          setSelectedId(admin.id);
                          setDraft([...admin.packages]);
                        }
                      }}
                    >
                      <td>{admin.displayName}</td>
                      <td>{roleLabel(admin.role)}</td>
                      <td>{admin.packages.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={shared.panel}>
            {selected ? (
              <>
                <h2 className={shared.sectionTitle}>
                  授权 · {selected.displayName}
                </h2>
                {!selected.editable ? (
                  <p className={shared.muted}>超级管理员拥有全部权限，不可编辑。</p>
                ) : (
                  <>
                    <div className={styles.grantGrid}>
                      {packages.map((pkg) => (
                        <div key={pkg.code} className={styles.grantItem}>
                          <input
                            id={`grant-${pkg.code}`}
                            type="checkbox"
                            checked={draft.includes(pkg.code)}
                            disabled={!pkg.grantableToAdmin}
                            onChange={() => togglePackage(pkg.code)}
                          />
                          <label htmlFor={`grant-${pkg.code}`}>
                            <strong>{pkg.name}</strong>
                            <small>{pkg.description}</small>
                            {!pkg.grantableToAdmin ? (
                              <small>（不可授予普通管理员）</small>
                            ) : null}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className={shared.btnRow}>
                      <button
                        type="button"
                        className={shared.btnPrimary}
                        disabled={saving}
                        onClick={() => void saveGrants()}
                      >
                        保存授权
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className={shared.muted}>请选择可编辑的管理员</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
