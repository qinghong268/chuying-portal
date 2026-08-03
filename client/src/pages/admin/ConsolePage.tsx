import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../admin/permissions";
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

export function ConsolePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [joinPending, setJoinPending] = useState<number | null>(null);
  const [pointPending, setPointPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [];
      if (hasPermission(user, "dashboard")) {
        tasks.push(
          api<DashboardSummary>("/api/admin/dashboard/summary").then((data) => {
            setSummary(data);
          }),
        );
      } else {
        if (hasPermission(user, "join_review")) {
          tasks.push(
            api<{ applications: { status: string }[] }>(
              "/api/admin/join-applications?status=pending",
            ).then((data) => setJoinPending(data.applications.length)),
          );
        }
        if (hasPermission(user, "point_review")) {
          tasks.push(
            api<{ applications: { status: string }[] }>(
              "/api/admin/point-applications?status=pending",
            ).then((data) => setPointPending(data.applications.length)),
          );
        }
      }
      await Promise.all(tasks);
    } catch {
      /* partial load ok */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingJoin = summary?.pendingJoinCount ?? joinPending ?? "—";
  const pendingPoints = summary?.pendingPointAppCount ?? pointPending ?? "—";
  const activeActivities = summary?.activeActivityCount ?? "—";

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <p className={shared.breadcrumb}>控制台</p>
          <h1 className={styles.pageHeadTitle}>控制台</h1>
          <p className={shared.muted}>欢迎，{user?.displayName ?? "管理员"}</p>
        </div>
      </div>

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : (
        <>
          <div className={styles.statGrid}>
            {(hasPermission(user, "join_review") || summary) && (
              <div className={`${shared.panel} ${styles.statCard}`}>
                <span className={styles.statLabel}>待审加入</span>
                <span className={styles.statValue}>{pendingJoin}</span>
                {hasPermission(user, "join_review") ? (
                  <Link to="/admin/join?status=pending" className={shared.btnGhost}>
                    去审核
                  </Link>
                ) : null}
              </div>
            )}
            {(hasPermission(user, "point_review") || summary) && (
              <div className={`${shared.panel} ${styles.statCard}`}>
                <span className={styles.statLabel}>待审积分</span>
                <span className={styles.statValue}>{pendingPoints}</span>
                {hasPermission(user, "point_review") ? (
                  <Link to="/admin/point-apps?status=pending" className={shared.btnGhost}>
                    去审批
                  </Link>
                ) : null}
              </div>
            )}
            {(hasPermission(user, "activity") || summary) && (
              <div className={`${shared.panel} ${styles.statCard}`}>
                <span className={styles.statLabel}>进行中活动</span>
                <span className={styles.statValue}>{activeActivities}</span>
                {hasPermission(user, "activity") ? (
                  <Link to="/admin/activities" className={shared.btnGhost}>
                    管理活动
                  </Link>
                ) : null}
              </div>
            )}
          </div>

          <section className={shared.panel}>
            <h2 className={shared.sectionTitle}>快捷入口</h2>
            <div className={styles.quickRow}>
              {hasPermission(user, "join_review") ? (
                <Link to="/admin/join" className={shared.btnSecondary}>
                  加入审核
                </Link>
              ) : null}
              {hasPermission(user, "point_review") ? (
                <Link to="/admin/point-apps" className={shared.btnSecondary}>
                  积分审批
                </Link>
              ) : null}
              {hasPermission(user, "activity") ? (
                <Link to="/admin/activities" className={shared.btnSecondary}>
                  活动管理
                </Link>
              ) : null}
              {hasPermission(user, "content") ? (
                <Link to="/admin/content" className={shared.btnSecondary}>
                  内容运营
                </Link>
              ) : null}
              {hasPermission(user, "dashboard") ? (
                <Link to="/admin/dashboard" className={shared.btnSecondary}>
                  数据看板
                </Link>
              ) : null}
            </div>
          </section>

          {summary ? (
            <section className={shared.panel} style={{ marginTop: "var(--space-lg)" }}>
              <h2 className={shared.sectionTitle}>数据摘要</h2>
              <p className={shared.muted}>
                活跃雏英 {summary.eagleCount} · 近 7 日报名 {summary.enrollmentsLast7d} ·
                近 7 日积分流水 {summary.ledgerCountLast7d} 笔 / +{summary.ledgerPointsLast7d} 分
              </p>
              <p className={shared.muted}>更新于 {formatDateTime(summary.generatedAt)}</p>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
