import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface DashboardSummary {
  eagleCount: number;
  pendingJoinCount: number;
  pendingPointAppCount: number;
  activeActivityCount: number;
  enrollmentsLast7d: number;
  ledgerCountLast7d: number;
  ledgerPointsLast7d: number;
  generatedAt: number;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<DashboardSummary>("/api/admin/dashboard/summary");
      setSummary(data);
    } catch {
      setError("看板数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className={styles.pageHeadTitle}>数据看板</h1>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : summary ? (
        <>
          <div className={styles.statGrid}>
            <div className={`${shared.panel} ${styles.statCard}`}>
              <span className={styles.statLabel}>活跃雏鹰</span>
              <span className={styles.statValue}>{summary.eagleCount}</span>
            </div>
            <div className={`${shared.panel} ${styles.statCard}`}>
              <span className={styles.statLabel}>待审加入</span>
              <span className={styles.statValue}>{summary.pendingJoinCount}</span>
            </div>
            <div className={`${shared.panel} ${styles.statCard}`}>
              <span className={styles.statLabel}>待审积分</span>
              <span className={styles.statValue}>{summary.pendingPointAppCount}</span>
            </div>
            <div className={`${shared.panel} ${styles.statCard}`}>
              <span className={styles.statLabel}>进行中活动</span>
              <span className={styles.statValue}>{summary.activeActivityCount}</span>
            </div>
            <div className={`${shared.panel} ${styles.statCard}`}>
              <span className={styles.statLabel}>近 7 日报名</span>
              <span className={styles.statValue}>{summary.enrollmentsLast7d}</span>
            </div>
            <div className={`${shared.panel} ${styles.statCard}`}>
              <span className={styles.statLabel}>近 7 日积分</span>
              <span className={styles.statValue}>+{summary.ledgerPointsLast7d}</span>
              <span className={shared.muted}>{summary.ledgerCountLast7d} 笔流水</span>
            </div>
          </div>
          <p className={shared.muted}>数据更新于 {formatDateTime(summary.generatedAt)}</p>
        </>
      ) : null}
    </>
  );
}
