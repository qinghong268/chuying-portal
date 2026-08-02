import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { contentStatusLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface ContentBlock {
  id: number;
  key: string;
  title: string;
  body: string;
  status: "draft" | "published";
  updatedAt: number;
}

export function ContentPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ blocks: ContentBlock[] }>("/api/admin/content/blocks");
      setBlocks(res.blocks);
      if (res.blocks.length > 0 && selectedId === null) {
        setSelectedId(res.blocks[0].id);
      }
    } catch {
      setError("内容块加载失败");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setBody(selected.body);
    }
  }, [selected?.id, selected?.title, selected?.body]);

  async function saveDraft() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ block: ContentBlock }>(
        `/api/admin/content/blocks/${selectedId}`,
        { method: "PUT", body: JSON.stringify({ title, body }) },
      );
      setBlocks((prev) => prev.map((b) => (b.id === res.block.id ? res.block : b)));
      setMessage("草稿已保存");
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api(`/api/admin/content/blocks/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ title, body }),
      });
      const res = await api<{ block: ContentBlock }>(
        `/api/admin/content/blocks/${selectedId}/publish`,
        { method: "POST" },
      );
      setBlocks((prev) => prev.map((b) => (b.id === res.block.id ? res.block : b)));
      setMessage("已发布到前台");
    } catch {
      setError("发布失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <p className={shared.breadcrumb}>内容运营</p>
          <h1 className={styles.pageHeadTitle}>内容运营</h1>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {message ? <p className={shared.muted}>{message}</p> : null}

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : (
        <div className={styles.grid2}>
          <div className={shared.panel}>
            <h2 className={shared.sectionTitle}>内容块</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>标题</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => (
                    <tr
                      key={block.id}
                      style={{
                        cursor: "pointer",
                        background: block.id === selectedId ? "rgba(13,148,136,0.06)" : undefined,
                      }}
                      onClick={() => setSelectedId(block.id)}
                    >
                      <td>{block.key}</td>
                      <td>{block.title}</td>
                      <td>{contentStatusLabel(block.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={shared.panel}>
            {selected ? (
              <>
                <h2 className={shared.sectionTitle}>编辑 · {selected.key}</h2>
                <p className={shared.muted}>
                  状态：{contentStatusLabel(selected.status)} · 更新于{" "}
                  {formatDateTime(selected.updatedAt)}
                </p>
                <div className={shared.formStack}>
                  <div className={shared.field}>
                    <label htmlFor="block-title">标题</label>
                    <input
                      id="block-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className={shared.field}>
                    <label htmlFor="block-body">正文</label>
                    <textarea
                      id="block-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={12}
                    />
                  </div>
                </div>
                <div className={shared.btnRow}>
                  <button
                    type="button"
                    className={shared.btnSecondary}
                    disabled={saving}
                    onClick={() => void saveDraft()}
                  >
                    存草稿
                  </button>
                  <button
                    type="button"
                    className={shared.btnPrimary}
                    disabled={saving}
                    onClick={() => void publish()}
                  >
                    发布
                  </button>
                </div>
              </>
            ) : (
              <p className={shared.muted}>请选择内容块</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
