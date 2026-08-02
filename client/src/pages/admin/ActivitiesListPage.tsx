import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  activityModeLabel,
  activityStatusLabel,
} from "../../lib/adminLabels";
import { formatDateTime, getActivityLifecycle, lifecycleLabel } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface AdminActivity {
  id: number;
  title: string;
  description: string;
  mode: "online" | "offline";
  startAt: number;
  endAt: number;
  enrollDeadline: number;
  targetPoints: number;
  status: "draft" | "published" | "archived";
  featured: boolean;
  createdAt: number;
}

export function ActivitiesListPage() {
  const [items, setItems] = useState<AdminActivity[]>([]);
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (status) query.set("status", status);
      if (mode) query.set("mode", mode);
      const res = await api<{ activities: AdminActivity[] }>(
        `/api/admin/activities?${query.toString()}`,
      );
      setItems(res.activities);
    } catch {
      setError("活动列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [status, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(id: number) {
    try {
      await api(`/api/admin/activities/${id}/publish`, { method: "POST" });
      void load();
    } catch {
      setError("发布失败");
    }
  }

  async function unpublish(id: number) {
    try {
      await api(`/api/admin/activities/${id}/unpublish`, { method: "POST" });
      void load();
    } catch {
      setError("下架失败");
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>活动管理</h1>
        <Link to="/admin/activities/new" className={shared.btnAccent}>
          新建活动
        </Link>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="act-status">状态</label>
          <select id="act-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </div>
        <div className={shared.field}>
          <label htmlFor="act-mode">形式</label>
          <select id="act-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">全部</option>
            <option value="online">线上</option>
            <option value="offline">线下</option>
          </select>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : items.length === 0 ? (
        <div className={shared.empty}>暂无活动</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>标题</th>
                <th>形式</th>
                <th>时间</th>
                <th>发布状态</th>
                <th>生命周期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((act) => {
                const life = getActivityLifecycle(act.startAt, act.endAt);
                return (
                  <tr key={act.id}>
                    <td>{act.title}</td>
                    <td>{activityModeLabel(act.mode)}</td>
                    <td>{formatDateTime(act.startAt)}</td>
                    <td>{activityStatusLabel(act.status)}</td>
                    <td>{lifecycleLabel(life)}</td>
                    <td className={styles.inlineActions}>
                      <Link to={`/admin/activities/${act.id}/edit`}>编辑</Link>
                      <span>·</span>
                      <Link to={`/admin/activities/${act.id}/enrollments`}>报名名单</Link>
                      {act.status === "draft" ? (
                        <>
                          <span>·</span>
                          <button type="button" onClick={() => void publish(act.id)}>
                            发布
                          </button>
                        </>
                      ) : act.status === "published" ? (
                        <>
                          <span>·</span>
                          <button type="button" onClick={() => void unpublish(act.id)}>
                            下架
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
