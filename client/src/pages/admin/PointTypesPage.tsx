import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface PointTypeTemplate {
  code: string;
  name: string;
  defaultPoints: number;
  enabled: boolean;
  allowApplicantEditPoints: boolean;
}

export function PointTypesPage() {
  const [templates, setTemplates] = useState<PointTypeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ templates: PointTypeTemplate[] }>("/api/admin/point-types");
      setTemplates(res.templates);
    } catch {
      setError("模板加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchTemplate(
    code: string,
    patch: Partial<{ name: string; defaultPoints: number; enabled: boolean }>,
  ) {
    setSaving(code);
    setError(null);
    try {
      const res = await api<{ template: PointTypeTemplate }>(
        `/api/admin/point-types/${code}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      setTemplates((prev) =>
        prev.map((t) => (t.code === code ? res.template : t)),
      );
    } catch {
      setError("更新失败");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>积分类型</h1>
      </div>
      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>名称</th>
                <th>默认分值</th>
                <th>启用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.code}>
                  <td>{t.code}</td>
                  <td>
                    <input
                      defaultValue={t.name}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== t.name) void patchTemplate(t.code, { name });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      defaultValue={t.defaultPoints}
                      onBlur={(e) => {
                        const defaultPoints = Number(e.target.value);
                        if (
                          Number.isInteger(defaultPoints) &&
                          defaultPoints !== t.defaultPoints
                        ) {
                          void patchTemplate(t.code, { defaultPoints });
                        }
                      }}
                    />
                  </td>
                  <td>{t.enabled ? "是" : "否"}</td>
                  <td>
                    <button
                      type="button"
                      disabled={saving === t.code}
                      onClick={() => void patchTemplate(t.code, { enabled: !t.enabled })}
                    >
                      {t.enabled ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
