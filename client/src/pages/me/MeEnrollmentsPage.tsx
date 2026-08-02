import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as chuyingShared from "@chuying/shared";
import { api } from "../../api/client";
import type { MeEnrollment } from "../../api/types";
import { formatDateRange } from "../../lib/datetime";
import { formatHoursRemaining } from "../../lib/meLabels";
import shared from "../shared.module.css";
import styles from "./me.module.css";

const WATCH_PROGRESS_THRESHOLD = chuyingShared.WATCH_PROGRESS_THRESHOLD ?? 99;

type ModeFilter = "all" | "online" | "offline";

export function MeEnrollmentsPage() {
  const [items, setItems] = useState<MeEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ enrollments: MeEnrollment[] }>("/api/me/enrollments");
      setItems(data.enrollments);
    } catch {
      setError("报名列表加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (mode === "all") return items;
    return items.filter((item) => item.activityMode === mode);
  }, [items, mode]);

  function progressLabel(item: MeEnrollment): string {
    if (item.activityMode === "online") {
      return `进度 ${item.progressPercent ?? 0}%`;
    }
    if (item.offlineWindowRemainingMs != null && item.offlineWindowRemainingMs > 0) {
      return `窗口剩余 ${formatHoursRemaining(item.offlineWindowRemainingMs)}`;
    }
    const now = Date.now();
    if (now < item.endAt) return "活动未结束";
    return "窗口已关闭";
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h2 className={styles.pageHeadTitle}>我的报名</h2>
        <Link to="/activities" className={shared.btnGhost}>
          去浏览活动 →
        </Link>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="enroll-mode">形态</label>
          <select
            id="enroll-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as ModeFilter)}
          >
            <option value="all">全部</option>
            <option value="online">线上</option>
            <option value="offline">线下</option>
          </select>
        </div>
      </div>

      {error ? (
        <div className={shared.btnRow}>
          <p className={shared.error}>{error}</p>
          <button type="button" className={shared.btnSecondary} onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : filtered.length === 0 ? (
        <div className={shared.empty}>
          <p>暂无报名记录</p>
          <p>去活动列表看看有什么适合你的活动</p>
          <Link to="/activities" className={shared.btnPrimary}>
            浏览活动
          </Link>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>活动标题</th>
                <th>形态</th>
                <th>时间</th>
                <th>报名状态</th>
                <th>进度/窗口</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/activities/${item.activityId}`}>{item.activityTitle}</Link>
                    {!item.activityPublished ? (
                      <span className={shared.muted}>（已下架）</span>
                    ) : null}
                  </td>
                  <td>{item.activityMode === "online" ? "线上" : "线下"}</td>
                  <td>{formatDateRange(item.startAt, item.endAt)}</td>
                  <td>已报名</td>
                  <td>{progressLabel(item)}</td>
                  <td>
                    {item.canApplyType1 ? (
                      <Link
                        to={`/me/applications/new?type=activity&activityId=${item.activityId}`}
                        className={shared.btnAccent}
                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                      >
                        申请心得
                      </Link>
                    ) : (
                      <span className={shared.muted}>
                        {item.applyBlockedReason ??
                          (item.activityMode === "online"
                            ? `进度需达到 ${WATCH_PROGRESS_THRESHOLD}%`
                            : "当前不可申请")}
                      </span>
                    )}
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
