import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ApplicationStatus, ApplicationType } from "../../api/types";
import { api } from "../../api/client";
import {
  applicationStatusLabel,
  applicationTypeLabel,
  formatApplicationNo,
} from "../../lib/meLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

function badgeClass(status: ApplicationStatus): string {
  switch (status) {
    case "pending":
      return styles.badgePending;
    case "approved":
      return styles.badgeApproved;
    case "rejected":
      return styles.badgeRejected;
  }
}

interface AdminPointApplicationListItem {
  id: number;
  userId: number;
  type: ApplicationType;
  templateCode: string | null;
  pointsRequested: number | null;
  status: ApplicationStatus;
  createdAt: number;
}

export function PointAppsListPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<AdminPointApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = params.get("status") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = status ? `?status=${status}` : "";
      const res = await api<{ applications: AdminPointApplicationListItem[] }>(
        `/api/admin/point-applications${query}`,
      );
      setItems(res.applications);
    } catch {
      setError("列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>积分审批</h1>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="pa-status">状态</label>
          <select
            id="pa-status"
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("status", e.target.value);
              else next.delete("status");
              setParams(next);
            }}
          >
            <option value="">全部</option>
            <option value="pending">待审批</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : items.length === 0 ? (
        <div className={shared.empty}>暂无申请</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>编号</th>
                <th>类型</th>
                <th>用户 ID</th>
                <th>申请分值</th>
                <th>提交时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((app) => (
                <tr key={app.id}>
                  <td>{formatApplicationNo(app.id)}</td>
                  <td>
                    {applicationTypeLabel(
                      app.type as ApplicationType,
                      app.templateCode,
                    )}
                  </td>
                  <td>{app.userId ?? "—"}</td>
                  <td>{app.pointsRequested ?? "—"}</td>
                  <td>{formatDateTime(app.createdAt)}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${badgeClass(app.status as ApplicationStatus)}`}
                    >
                      {applicationStatusLabel(app.status as ApplicationStatus)}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/point-apps/${app.id}`}>详情</Link>
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
