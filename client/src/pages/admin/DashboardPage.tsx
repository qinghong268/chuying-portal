import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { AiInsightBar } from "./components/AiInsightBar";
import { TodoQueue } from "./components/TodoQueue";
import { StatsCards } from "./components/StatsCards";
import { TrendChart } from "./components/TrendChart";
import { DetailDrawer } from "./components/DetailDrawer";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./DashboardPage.module.css";

interface DashboardSummary {
  eagleCount: number;
  pendingJoinCount: number;
  pendingPointAppCount: number;
  activeActivityCount: number;
  enrollmentsLast7d: number;
  ledgerCountLast7d: number;
  ledgerPointsLast7d: number;
  generatedAt: number;
  dailyStats: Array<{ date: string; enrollments: number; points: number }>;
  prevWeek?: {
    enrollments: number;
    points: number;
    ledgerCount: number;
  } | null;
  sparklines?: {
    enrollments: Array<{ date: string; value: number }>;
    points: Array<{ date: string; value: number }>;
  } | null;
  pendingJoins?: Array<{
    id: number;
    name: string;
    contact: string;
    created_at: number;
  }> | null;
  pendingPointApps?: Array<{
    id: number;
    type: string;
    points_requested: number;
    created_at: number;
    user_display_name: string;
    ai_score?: number;
    ai_action?: string;
  }> | null;
  activeActivity?: {
    id: number;
    title: string;
    end_at: number;
    enrollment_count: number;
  } | null;
  dailyDetail?: Array<{
    date: string;
    enrollments: Array<{ id: number; userName: string; activityTitle: string }>;
    ledger: Array<{ id: number; delta: number; description: string }>;
  }> | null;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailDay, setDetailDay] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<DashboardSummary>("/api/admin/dashboard/summary");
      setSummary(data);
    } catch {
      setError("数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className={shared.muted}>加载中…</p>;
  if (!summary) return <p className={shared.error}>{error || "数据不可用"}</p>;

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>数据看板</h1>
        <div className={styles.headerRight}>
          <span className={shared.muted}>更新于 {formatDateTime(summary.generatedAt)}</span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={shared.btnSecondary}
          >
            刷新
          </button>
        </div>
      </div>

      {/* AI 洞察条 */}
      <AiInsightBar />

      {/* 主区域: 待办队列(左2/3) + 指标卡片(右1/3) */}
      <div className={styles.mainGrid}>
        <div className={styles.todoCol}>
          <TodoQueue
            pendingJoins={summary.pendingJoins || []}
            pendingPointApps={summary.pendingPointApps || []}
            activeActivity={summary.activeActivity || null}
          />
        </div>
        <div className={styles.statsCol}>
          <StatsCards {...summary} />
        </div>
      </div>

      {/* 趋势图 */}
      <TrendChart
        dailyStats={summary.dailyStats || []}
        onDayClick={(i) => setDetailDay(i)}
      />

      {/* 每日明细抽屉 */}
      <DetailDrawer
        dayIndex={detailDay}
        dailyDetail={summary.dailyDetail || []}
        onClose={() => setDetailDay(null)}
      />
    </div>
  );
}
