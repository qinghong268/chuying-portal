import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { activityModeLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface EnrollmentRow {
  id: number;
  userId: number;
  email: string;
  displayName: string;
  status: string;
  enrolledAt: number;
  watchPercent?: number;
}

interface AdminActivity {
  id: number;
  title: string;
  mode: "online" | "offline";
}

export function ActivityEnrollmentsPage() {
  const { id } = useParams();
  const [activity, setActivity] = useState<AdminActivity | null>(null);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        activity: AdminActivity;
        enrollments: EnrollmentRow[];
      }>(`/api/admin/activities/${id}/enrollments`);
      setActivity(res.activity);
      setRows(res.enrollments);
    } catch {
      setError("报名名单加载失败");
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
        <Link to="/admin/activities">活动管理</Link> / 报名名单
      </p>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageHeadTitle}>{activity?.title ?? "报名名单"}</h1>
          {activity ? (
            <p className={shared.muted}>{activityModeLabel(activity.mode)} · 共 {rows.length} 人</p>
          ) : null}
        </div>
        {id ? (
          <Link to={`/admin/activities/${id}/edit`} className={shared.btnSecondary}>
            编辑活动
          </Link>
        ) : null}
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : rows.length === 0 ? (
        <div className={shared.empty}>暂无报名</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>用户</th>
                <th>邮箱</th>
                <th>报名时间</th>
                <th>状态</th>
                {activity?.mode === "online" ? <th>观看进度</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.displayName}</td>
                  <td>{row.email}</td>
                  <td>{formatDateTime(row.enrolledAt)}</td>
                  <td>{row.status}</td>
                  {activity?.mode === "online" ? (
                    <td>{row.watchPercent ?? 0}%</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
