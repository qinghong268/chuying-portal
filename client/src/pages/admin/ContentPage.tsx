import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "../../api/client";
import { ImageUpload } from "../../components/ImageUpload";
import { contentStatusLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface ContentBlock {
  id: number;
  key: string;
  title: string;
  summary?: string;
  body: string;
  status: "draft" | "published";
  updatedAt: number;
  coverUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  sortOrder?: number;
}

export function ContentPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

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
      setSummary(selected.summary ?? "");
      setBody(selected.body);
      setCoverUrl(selected.coverUrl ?? "");
      setLinkUrl(selected.linkUrl ?? "");
      setLinkLabel(selected.linkLabel ?? "");
    }
  }, [selected?.id]);

  // Wrap the selected text in the body textarea with the given HTML tag, or
  // insert a raw tag at the cursor when there is no selection (e.g. <img>).
  function insertTag(tag: string, raw = false) {
    const ta = document.getElementById("block-body") as HTMLTextAreaElement | null;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = raw
      ? `<${tag}>`
      : selected
        ? `<${tag}>${selected}</${tag}>`
        : `<${tag}></${tag}>`;
    const next = body.substring(0, start) + replacement + body.substring(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + replacement.length, start + replacement.length);
    });
  }

  async function saveDraft() {
    if (!selectedId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ block: ContentBlock }>(
        `/api/admin/content/blocks/${selectedId}`,
        {
          method: "PUT",
          body: JSON.stringify({ title, summary, body, coverUrl, linkUrl, linkLabel }),
        },
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
        body: JSON.stringify({ title, summary, body, coverUrl, linkUrl, linkLabel }),
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

  async function createBlock() {
    const key = newKey.trim();
    const name = newTitle.trim();
    if (!key || !name) {
      setError("请填写 Key 与标题");
      return;
    }
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ block: ContentBlock }>("/api/admin/content/blocks", {
        method: "POST",
        body: JSON.stringify({ block_key: key, title: name }),
      });
      setNewKey("");
      setNewTitle("");
      setShowCreate(false);
      await load();
      setSelectedId(res.block.id);
      setMessage("内容块已创建，可继续编辑");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function deleteBlock(block: ContentBlock) {
    if (!window.confirm(`确定删除内容块「${block.key}」？删除后不可恢复。`)) return;
    setError(null);
    setMessage(null);
    try {
      await api(`/api/admin/content/blocks/${block.id}`, { method: "DELETE" });
      if (selectedId === block.id) {
        setSelectedId(null);
        setTitle("");
        setSummary("");
        setBody("");
        setCoverUrl("");
        setLinkUrl("");
        setLinkLabel("");
      }
      await load();
      setMessage("内容块已删除");
    } catch {
      setError("删除失败");
    }
  }

  async function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setError(null);
    setMessage(null);
    try {
      const reordered = [...blocks];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      const orders = reordered.map((b, i) => ({ id: b.id, sort_order: i }));
      await api("/api/admin/content/blocks/sort", {
        method: "PATCH",
        body: JSON.stringify({ orders }),
      });
      await load();
    } catch {
      setError("排序保存失败");
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <p className={shared.breadcrumb}>内容运营</p>
          <h1 className={styles.pageHeadTitle}>内容运营</h1>
        </div>
        <button
          type="button"
          className={shared.btnAccent}
          onClick={() => {
            setError(null);
            setShowCreate(true);
          }}
        >
          新建内容块
        </button>
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
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block, index) => (
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
                      <td>
                        <div className={styles.inlineActions}>
                          <button
                            type="button"
                            title="上移"
                            disabled={index === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveBlock(index, -1);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="下移"
                            disabled={index === blocks.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              void moveBlock(index, 1);
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteBlock(block);
                            }}
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
                    <label htmlFor="block-summary">简介（首页卡片展示）</label>
                    <textarea
                      id="block-summary"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className={styles.editorToolbar} role="toolbar" aria-label="正文编辑工具">
                    <button
                      type="button"
                      onClick={() => insertTag("strong")}
                      title="加粗所选文字"
                    >
                      加粗
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("p")}
                      title="包裹为段落"
                    >
                      段落
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("img src=\"\" alt=\"\"", true)}
                      title="插入图片标签（src 填入上传的图片地址）"
                    >
                      图片
                    </button>
                    <button
                      type="button"
                      onClick={() => insertTag("a href=\"\"")}
                      title="为所选文字添加链接"
                    >
                      链接
                    </button>
                  </div>
                  <div className={shared.field}>
                    <label htmlFor="block-body">正文（HTML）</label>
                    <textarea
                      id="block-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={12}
                    />
                  </div>
                  <div className={shared.field}>
                    <label>首页图片（上传）</label>
                    <ImageUpload
                      currentUrl={coverUrl}
                      onUploaded={(url) => setCoverUrl(url)}
                    />
                  </div>
                  <div className={shared.field}>
                    <label htmlFor="block-link">跳转链接</label>
                    <input
                      id="block-link"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com/page"
                    />
                  </div>
                  <div className={shared.field}>
                    <label htmlFor="block-link-label">按钮文案</label>
                    <input
                      id="block-link-label"
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      placeholder="了解更多"
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

      {showCreate ? (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setError(null);
            setShowCreate(false);
          }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="新建内容块"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={shared.sectionTitle}>新建内容块</h2>
            <div className={shared.formStack}>
              <div className={shared.field}>
                <label htmlFor="new-block-key">Key</label>
                <input
                  id="new-block-key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="home_partners"
                />
              </div>
              <div className={shared.field}>
                <label htmlFor="new-block-title">标题</label>
                <input
                  id="new-block-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="合作伙伴"
                />
              </div>
            </div>
            <div className={shared.btnRow}>
              <button
                type="button"
                className={shared.btnSecondary}
                onClick={() => {
                  setError(null);
                  setShowCreate(false);
                }}
              >
                取消
              </button>
              <button
                type="button"
                className={shared.btnPrimary}
                disabled={creating}
                onClick={() => void createBlock()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
