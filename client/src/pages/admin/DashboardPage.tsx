import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  dailyStats?: Array<{ date: string; enrollments: number; points: number }>;
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
        <button
          type="button"
          className={shared.btnSecondary}
          onClick={() => void load()}
          disabled={loading}
        >
          刷新
        </button>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : summary ? (
        <>
          <div className={styles.statGrid}>
            <Link
              to="/admin/users?role=eagle"
              className={`${shared.panel} ${styles.statCard} ${styles.statCardClickable}`}
            >
              <span className={styles.statLabel}>活跃雏英</span>
              <span className={styles.statValue}>{summary.eagleCount}</span>
            </Link>
            <Link
              to="/admin/join"
              className={`${shared.panel} ${styles.statCard} ${styles.statCardClickable}`}
            >
              <span className={styles.statLabel}>待审加入</span>
              <span className={styles.statValue}>{summary.pendingJoinCount}</span>
            </Link>
            <Link
              to="/admin/point-apps"
              className={`${shared.panel} ${styles.statCard} ${styles.statCardClickable}`}
            >
              <span className={styles.statLabel}>待审积分</span>
              <span className={styles.statValue}>{summary.pendingPointAppCount}</span>
            </Link>
            <Link
              to="/admin/activities"
              className={`${shared.panel} ${styles.statCard} ${styles.statCardClickable}`}
            >
              <span className={styles.statLabel}>进行中活动</span>
              <span className={styles.statValue}>{summary.activeActivityCount}</span>
            </Link>
            <Link
              to="/admin/activities"
              className={`${shared.panel} ${styles.statCard} ${styles.statCardClickable}`}
            >
              <span className={styles.statLabel}>近 7 日报名</span>
              <span className={styles.statValue}>{summary.enrollmentsLast7d}</span>
            </Link>
            <Link
              to="/admin/point-apps"
              className={`${shared.panel} ${styles.statCard} ${styles.statCardClickable}`}
            >
              <span className={styles.statLabel}>近 7 日积分</span>
              <span className={styles.statValue}>+{summary.ledgerPointsLast7d}</span>
              <span className={shared.muted}>{summary.ledgerCountLast7d} 笔流水</span>
            </Link>
          </div>

          {summary.dailyStats ? (
            <div className={shared.panel}>
              <h3>近7日趋势</h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 12,
                  height: 150,
                  padding: "16px 0",
                }}
              >
                {summary.dailyStats.map((d) => (
                  <div
                    key={d.date}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 2,
                        width: "100%",
                      }}
                    >
                      <div
                        title={`报名 ${d.enrollments}`}
                        style={{
                          width: "100%",
                          background: "#0D9488",
                          height: Math.max(4, d.enrollments * 20),
                          borderRadius: "4px 4px 0 0",
                          minHeight: 4,
                        }}
                      />
                      <div
                        title={`积分 +${d.points}`}
                        style={{
                          width: "60%",
                          background: "#D97706",
                          height: Math.max(4, d.points / 5),
                          borderRadius: "4px 4px 0 0",
                          minHeight: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "#666" }}>{d.date}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#666" }}>
                <span>■ 报名</span>
                <span>■ 积分</span>
              </div>
            </div>
          ) : null}

          <p className={shared.muted}>数据更新于 {formatDateTime(summary.generatedAt)}</p>
        </>
      ) : null}
    </>
  );
}
