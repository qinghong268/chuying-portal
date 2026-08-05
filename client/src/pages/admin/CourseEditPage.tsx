import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { ImageUpload } from "../../components/ImageUpload";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface AdminCourse {
  id: number;
  title: string;
  description: string;
  videoUrl?: string;
  coverUrl?: string;
  status: "draft" | "published" | "archived";
  featured: boolean;
  sortOrder: number;
}

const defaultForm = () => ({
  title: "",
  description: "",
  videoUrl: "",
  coverUrl: "",
  sortOrder: 0,
  featured: false,
});

export function CourseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new" || !id;
  const [form, setForm] = useState(defaultForm());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const res = await api<{ course: AdminCourse }>(`/api/admin/courses/${id}`);
      const c = res.course;
      setForm({
        title: c.title,
        description: c.description,
        videoUrl: c.videoUrl ?? "",
        coverUrl: c.coverUrl ?? "",
        sortOrder: c.sortOrder,
        featured: c.featured,
      });
    } catch {
      setError("课程加载失败");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent, publish = false) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      videoUrl: form.videoUrl.trim() || null,
      coverUrl: form.coverUrl.trim() || null,
      sortOrder: form.sortOrder,
      featured: form.featured,
    };
    if (publish) {
      payload.status = "published";
    } else if (isNew) {
      payload.status = "draft";
    }
    try {
      if (isNew) {
        const res = await api<{ course: AdminCourse }>("/api/admin/courses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        navigate(`/admin/courses/${res.course.id}/edit`, { replace: true });
      } else {
        await api(`/api/admin/courses/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        void load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={shared.muted}>加载中…</p>;

  return (
    <>
      <p className={shared.breadcrumb}>
        <Link to="/admin/courses">课程管理</Link> / {isNew ? "新建" : "编辑"}
      </p>
      <h1 className={styles.pageHeadTitle}>{isNew ? "新建课程" : "编辑课程"}</h1>
      {error ? <p className={shared.error}>{error}</p> : null}

      <form className={shared.panel} onSubmit={(e) => void submit(e, false)}>
        <div className={shared.formStack}>
          <div className={shared.field}>
            <label htmlFor="course-title">标题</label>
            <input
              id="course-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="course-desc">描述</label>
            <textarea
              id="course-desc"
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="course-video-url">视频（上传）</label>
            <ImageUpload
              currentUrl={form.videoUrl || undefined}
              onUploaded={(url) => setForm({ ...form, videoUrl: url })}
            />
            <p className={shared.muted}>课程为随时可看的视频，上传后可在线播放（支持 mp4/webm，最大 100MB）。</p>
          </div>
          <div className={shared.field}>
            <label htmlFor="course-cover-url">封面图片链接</label>
            <input
              id="course-cover-url"
              type="url"
              value={form.coverUrl}
              onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
              placeholder="https://example.com/cover.jpg"
              maxLength={2000}
            />
            <p className={shared.muted}>无视频时展示封面，留空则前台显示占位。</p>
          </div>
          <div className={shared.field}>
            <label htmlFor="course-sort">排序（数字越小越靠前）</label>
            <input
              id="course-sort"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />{" "}
            首页精选
          </label>
        </div>
        <div className={shared.btnRow}>
          <button type="submit" className={shared.btnSecondary} disabled={saving}>
            {isNew ? "存草稿" : "仅保存"}
          </button>
          <button
            type="button"
            className={shared.btnPrimary}
            disabled={saving}
            onClick={(e) => void submit(e, true)}
          >
            保存并发布
          </button>
          <Link to="/admin/courses" className={shared.btnGhost}>
            返回列表
          </Link>
        </div>
      </form>
    </>
  );
}
