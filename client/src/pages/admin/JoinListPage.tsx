import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { joinStatusLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface JoinApplication {
  id: number;
  name: string;
  contact: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt: number | null;
  rejectReason: string | null;
}

function badgeClass(status: string): string {
  switch (status) {
    case "pending":
      return styles.badgePending;
    case "approved":
      return styles.badgeApproved;
    case "rejected":
      return styles.badgeRejected;
    default:
      return "";
  }
}

export function JoinListPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<JoinApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (status) query.set("status", status);
      if (q) query.set("q", q);
      const res = await api<{ applications: JoinApplication[] }>(
        `/api/admin/join-applications?${query.toString()}`,
      );
      setItems(res.applications);
    } catch {
      setError("列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => items, [items]);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>加入审核</h1>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="join-status">状态</label>
          <select
            id="join-status"
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("status", e.target.value);
              else next.delete("status");
              setParams(next);
            }}
          >
            <option value="" disabled>全部</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
        <div className={`${shared.field} ${shared.fieldGrow}`}>
          <label htmlFor="join-q">关键词</label>
          <input
            id="join-q"
            defaultValue={q}
            placeholder="姓名 / 联系方式 / 留言"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = new URLSearchParams(params);
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) next.set("q", val);
                else next.delete("q");
                setParams(next);
              }
            }}
          />
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : filtered.length === 0 ? (
        <div className={shared.empty}>暂无申请</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>姓名</th>
                <th>联系方式</th>
                <th>提交时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id}>
                  <td>{app.name}</td>
                  <td>{app.contact}</td>
                  <td>{formatDateTime(app.createdAt)}</td>
                  <td>
                    <span className={`${styles.badge} ${badgeClass(app.status)}`}>
                      {joinStatusLabel(app.status)}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/join/${app.id}`}>详情</Link>
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
