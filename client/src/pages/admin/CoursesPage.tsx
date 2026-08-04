import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { activityStatusLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
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
  createdAt: number;
}

export function CoursesPage() {
  const [items, setItems] = useState<AdminCourse[]>([]);
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (status) query.set("status", status);
      if (keyword.trim()) query.set("q", keyword.trim());
      const res = await api<{ courses: AdminCourse[] }>(
        `/api/admin/courses?${query.toString()}`,
      );
      setItems(res.courses);
    } catch {
      setError("课程列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [status, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(id: number) {
    try {
      await api(`/api/admin/courses/${id}/publish`, { method: "POST" });
      void load();
    } catch {
      setError("发布失败");
    }
  }

  async function unpublish(id: number) {
    try {
      await api(`/api/admin/courses/${id}/unpublish`, { method: "POST" });
      void load();
    } catch {
      setError("下架失败");
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>课程管理</h1>
        <Link to="/admin/courses/new" className={shared.btnAccent}>
          新建课程
        </Link>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="course-status">状态</label>
          <select id="course-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className={`${shared.field} ${shared.fieldGrow}`}>
          <label htmlFor="course-q">关键词</label>
          <input
            id="course-q"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索课程标题或描述"
          />
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : items.length === 0 ? (
        <div className={shared.empty}>暂无课程</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>标题</th>
                <th>视频 / 封面</th>
                <th>发布状态</th>
                <th>排序</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((course) => (
                <tr key={course.id}>
                  <td>{course.title}</td>
                  <td>
                    {course.videoUrl ? <span className={shared.tag}>有视频</span> : null}
                    {course.coverUrl ? <span className={shared.tag}>有封面</span> : null}
                    {!course.videoUrl && !course.coverUrl ? (
                      <span className={shared.muted}>—</span>
                    ) : null}
                  </td>
                  <td>{activityStatusLabel(course.status)}</td>
                  <td>{course.sortOrder}</td>
                  <td>{formatDateTime(course.createdAt)}</td>
                  <td className={styles.inlineActions}>
                    <Link to={`/admin/courses/${course.id}/edit`}>编辑</Link>
                    <span>·</span>
                    <Link to={`/admin/courses/${course.id}/enrollments`}>学习名单</Link>
                    {course.status === "draft" ? (
                      <>
                        <span>·</span>
                        <button type="button" onClick={() => void publish(course.id)}>
                          发布
                        </button>
                      </>
                    ) : course.status === "published" ? (
                      <>
                        <span>·</span>
                        <button type="button" onClick={() => void unpublish(course.id)}>
                          下架
                        </button>
                      </>
                    ) : null}
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
