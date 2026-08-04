import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
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
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [defaultPoints, setDefaultPoints] = useState("");

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

  function resetCreateForm() {
    setCode("");
    setName("");
    setDefaultPoints("");
  }

  async function createTemplate() {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    const points = Number(defaultPoints);
    if (
      !trimmedCode ||
      !trimmedName ||
      !Number.isInteger(points) ||
      points < 1 ||
      points > 9999
    ) {
      setError("请填写编码、名称，默认分值为 1-9999 的整数");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await api<{ template: PointTypeTemplate }>(
        "/api/admin/point-types",
        {
          method: "POST",
          body: JSON.stringify({
            code: trimmedCode,
            name: trimmedName,
            defaultPoints: points,
          }),
        },
      );
      setTemplates((prev) => [...prev, res.template]);
      setShowCreate(false);
      resetCreateForm();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409 ? "模板编码已存在" : "添加失败",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteTemplate(t: PointTypeTemplate) {
    const ok = window.confirm(`确认删除积分类型「${t.name}」（${t.code}）？`);
    if (!ok) return;

    setDeleting(t.code);
    setError(null);
    try {
      await api(`/api/admin/point-types/${t.code}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((x) => x.code !== t.code));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? "该类型正在使用中，无法删除"
          : "删除失败",
      );
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>积分类型</h1>
        <button
          type="button"
          className={shared.btnPrimary}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "收起表单" : "添加类型"}
        </button>
      </div>
      {error ? <p className={shared.error}>{error}</p> : null}
      {showCreate ? (
        <div className={shared.panel} style={{ marginBottom: "var(--space-lg)" }}>
          <h3>新增积分类型</h3>
          <div className={shared.filters}>
            <div className={shared.field}>
              <label htmlFor="pt-code">Code</label>
              <input
                id="pt-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className={shared.field}>
              <label htmlFor="pt-name">名称</label>
              <input
                id="pt-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className={shared.field}>
              <label htmlFor="pt-points">默认分值</label>
              <input
                id="pt-points"
                type="number"
                min={1}
                max={9999}
                required
                value={defaultPoints}
                onChange={(e) => setDefaultPoints(e.target.value)}
              />
            </div>
          </div>
          <div className={shared.btnRow}>
            <button
              type="button"
              className={shared.btnPrimary}
              disabled={creating}
              onClick={() => void createTemplate()}
            >
              确认添加
            </button>
            <button
              type="button"
              className={shared.btnSecondary}
              disabled={creating}
              onClick={() => {
                setShowCreate(false);
                resetCreateForm();
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
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
                    <div className={shared.btnRow}>
                      <button
                        type="button"
                        disabled={saving === t.code}
                        onClick={() =>
                          void patchTemplate(t.code, { enabled: !t.enabled })
                        }
                      >
                        {t.enabled ? "停用" : "启用"}
                      </button>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        disabled={deleting === t.code}
                        onClick={() => void deleteTemplate(t)}
                      >
                        删除
                      </button>
                    </div>
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
