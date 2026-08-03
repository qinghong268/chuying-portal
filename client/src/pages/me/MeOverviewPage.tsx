import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { PointApplication } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import shared from "../shared.module.css";
import styles from "./me.module.css";

interface OverviewData {
  balance: number;
  eligibleCount: number;
  pendingCount: number;
}

export function MeOverviewPage() {
  const { user } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pointsRes, appsRes, eligibleRes] = await Promise.all([
        api<{ balance: number }>("/api/me/points"),
        api<{ applications: PointApplication[] }>("/api/me/point-applications"),
        api<{ activities: { id: number }[] }>(
          "/api/me/point-applications/eligible-activities",
        ),
      ]);
      setData({
        balance: pointsRes.balance,
        eligibleCount: eligibleRes.activities.length,
        pendingCount: appsRes.applications.filter((a) => a.status === "pending").length,
      });
    } catch {
      setError("概览加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayName = user?.displayName || "雏英";
  const accountStatus = user?.status === "disabled" ? "已禁用" : "正常";

  return (
    <>
      <div className={`${shared.panel} ${styles.welcome}`}>
        <div>
          <strong>你好，{displayName}</strong>
        </div>
        <span className={shared.muted}>账号状态：{accountStatus}</span>
      </div>

      {error ? (
        <div className={shared.btnRow}>
          <p className={shared.error}>{error}</p>
          <button type="button" className={shared.btnSecondary} onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : null}

      <div className={styles.grid2}>
        <section className={`${shared.panel} ${styles.statCard}`}>
          <span className={styles.statLabel}>当前积分</span>
          {loading ? (
            <div className={styles.skeleton} style={{ width: "4rem" }} />
          ) : (
            <span className={styles.statValue}>{data?.balance ?? "—"}</span>
          )}
          <div className={styles.statActions}>
            <Link to="/me/points" className={shared.btnGhost}>
              查看明细 →
            </Link>
          </div>
        </section>

        <section className={`${shared.panel} ${styles.statCard}`}>
          <span className={styles.statLabel}>待办</span>
          {loading ? (
            <div className={styles.skeleton} style={{ width: "6rem" }} />
          ) : (
            <>
              <p className={shared.muted}>
                可发起申请：{data?.eligibleCount ?? 0} 条
              </p>
              <p className={shared.muted}>
                审批中：{data?.pendingCount ?? 0} 条
              </p>
            </>
          )}
          <div className={styles.statActions}>
            {user?.status !== "disabled" ? (
              <Link to="/me/applications/new" className={shared.btnAccent}>
                去申请
              </Link>
            ) : null}
            <Link
              to="/me/applications?status=pending"
              className={shared.btnSecondary}
            >
              查看申请
            </Link>
          </div>
        </section>
      </div>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>快捷入口</h2>
        <div className={styles.quickGrid}>
          <Link to="/me/enrollments" className={styles.quickLink}>
            我的报名
          </Link>
          <Link to="/me/applications" className={styles.quickLink}>
            我的申请
          </Link>
          <Link to="/me/points" className={styles.quickLink}>
            积分明细
          </Link>
          {user?.status !== "disabled" ? (
            <Link to="/me/applications/new" className={styles.quickLink}>
              发起积分申请
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
