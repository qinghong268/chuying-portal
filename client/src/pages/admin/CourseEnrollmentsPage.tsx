import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface EnrollmentRow {
  id: number;
  userId: number;
  email: string;
  displayName: string;
  enrolledAt: number;
  progressPercent: number;
}

interface AdminCourse {
  id: number;
  title: string;
}

export function CourseEnrollmentsPage() {
  const { id } = useParams();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        course: AdminCourse;
        enrollments: EnrollmentRow[];
      }>(`/api/admin/courses/${id}/enrollments`);
      setCourse(res.course);
      setRows(res.enrollments);
    } catch {
      setError("学习名单加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <p className={shared.breadcrumb}>
        <Link to="/admin/courses">课程管理</Link> / 学习名单
      </p>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageHeadTitle}>{course?.title ?? "学习名单"}</h1>
          {course ? <p className={shared.muted}>共 {rows.length} 人</p> : null}
        </div>
        {id ? (
          <Link to={`/admin/courses/${id}/edit`} className={shared.btnSecondary}>
            编辑课程
          </Link>
        ) : null}
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : rows.length === 0 ? (
        <div className={shared.empty}>暂无学员</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>用户</th>
                <th>邮箱</th>
                <th>报名时间</th>
                <th>学习进度</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName}</td>
                  <td>{row.email}</td>
                  <td>{formatDateTime(row.enrolledAt)}</td>
                  <td>{row.progressPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
