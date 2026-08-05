import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface KbDocument {
  id: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface KbDocumentSummary {
  id: number;
  title: string;
  updatedAt: number;
}

export function KbPage() {
  const [documents, setDocuments] = useState<KbDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  // Edit form (inline)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ documents: KbDocumentSummary[] }>("/api/admin/kb");
      setDocuments(res.documents);
    } catch {
      setError("知识库文档加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDocument() {
    const title = newTitle.trim();
    if (!title) {
      setError("请填写文档标题");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ document: KbDocument }>("/api/admin/kb", {
        method: "POST",
        body: JSON.stringify({ title, content: newContent }),
      });
      setNewTitle("");
      setNewContent("");
      setShowCreate(false);
      await load();
      setMessage(`文档「${res.document.title}」已创建`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(doc: KbDocumentSummary) {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditContent("");
    setMessage(null);
    setError(null);
    void api<{ document: KbDocument }>(`/api/admin/kb/${doc.id}`)
      .then((res) => setEditContent(res.document.content))
      .catch(() => setError("文档内容加载失败"));
  }

  async function saveEdit() {
    if (editingId === null) return;
    const title = editTitle.trim();
    if (!title) {
      setError("请填写文档标题");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ document: KbDocument }>(`/api/admin/kb/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ title, content: editContent }),
      });
      setEditingId(null);
      await load();
      setMessage(`文档「${res.document.title}」已保存`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(doc: KbDocumentSummary) {
    if (!window.confirm(`确定删除文档「${doc.title}」？删除后不可恢复。`)) return;
    setMessage(null);
    setError(null);
    try {
      await api(`/api/admin/kb/${doc.id}`, { method: "DELETE" });
      if (editingId === doc.id) {
        setEditingId(null);
      }
      await load();
      setMessage(`文档「${doc.title}」已删除`);
    } catch {
      setError("删除失败");
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <p className={shared.breadcrumb}>知识库</p>
          <h1 className={styles.pageHeadTitle}>AI 知识库</h1>
        </div>
        <button
          type="button"
          className={shared.btnAccent}
          onClick={() => {
            setError(null);
            setShowCreate((v) => !v);
          }}
        >
          {showCreate ? "收起表单" : "新建文档"}
        </button>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {message ? <p className={shared.muted}>{message}</p> : null}

      {showCreate ? (
        <div className={shared.panel} style={{ marginBottom: "var(--space-lg)" }}>
          <h2 className={shared.sectionTitle}>新建文档</h2>
          <div className={shared.formStack}>
            <div className={shared.field}>
              <label htmlFor="kb-new-title">标题</label>
              <input
                id="kb-new-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例如：雏英计划积分规则"
              />
            </div>
            <div className={shared.field}>
              <label htmlFor="kb-new-content">内容（AI 问答参考的知识原文）</label>
              <textarea
                id="kb-new-content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={8}
                placeholder="输入知识内容，AI 助手将基于此回答学员问题"
              />
            </div>
          </div>
          <div className={shared.btnRow}>
            <button
              type="button"
              className={shared.btnPrimary}
              disabled={saving}
              onClick={() => void createDocument()}
            >
              创建
            </button>
            <button
              type="button"
              className={shared.btnSecondary}
              disabled={saving}
              onClick={() => {
                setShowCreate(false);
                setError(null);
              }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {editingId !== null ? (
        <div className={shared.panel} style={{ marginBottom: "var(--space-lg)" }}>
          <h2 className={shared.sectionTitle}>编辑文档</h2>
          <div className={shared.formStack}>
            <div className={shared.field}>
              <label htmlFor="kb-edit-title">标题</label>
              <input
                id="kb-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className={shared.field}>
              <label htmlFor="kb-edit-content">内容（AI 问答参考的知识原文）</label>
              <textarea
                id="kb-edit-content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
              />
            </div>
          </div>
          <div className={shared.btnRow}>
            <button
              type="button"
              className={shared.btnPrimary}
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              保存
            </button>
            <button
              type="button"
              className={shared.btnSecondary}
              disabled={saving}
              onClick={() => {
                setEditingId(null);
                setError(null);
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
        <div className={shared.panel}>
          <h2 className={shared.sectionTitle}>文档列表</h2>
          {documents.length === 0 ? (
            <p className={shared.muted}>
              暂无文档。点击「新建文档」添加第一条知识，AI 助手即可在问答中引用。
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>{doc.title}</td>
                      <td>{formatDateTime(doc.updatedAt)}</td>
                      <td>
                        <div className={styles.inlineActions}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreate(false);
                              startEdit(doc);
                            }}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => void deleteDocument(doc)}
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
        </div>
      )}
    </>
  );
}
