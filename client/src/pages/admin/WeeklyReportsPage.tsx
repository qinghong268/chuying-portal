import { Fragment, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface WeeklyReport {
  id: number;
  userId: number;
  userDisplayName: string | null;
  weekStart: string;
  enrollmentsCount: number;
  coursesProgressed: number;
  pointsEarned: number;
  applicationsCount: number;
  aiSummary: string | null;
  createdAt: number;
}

interface ReportWeek {
  weekStart: string;
  reports: WeeklyReport[];
}

export function WeeklyReportsPage() {
  const [weeks, setWeeks] = useState<ReportWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ weeks: ReportWeek[] }>("/api/admin/weekly-reports");
      setWeeks(res.weeks);
    } catch {
      setError("周报列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!window.confirm("将为所有活跃雏英生成本周周报（覆盖同周已有记录），确定继续？")) {
      return;
    }
    setGenerating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ generated: number; failed: number; weekStart: string }>(
        "/api/admin/weekly-reports/generate",
        { method: "POST" },
      );
      setMessage(
        `已为 ${res.generated} 位学员生成第 ${res.weekStart} 周周报` +
          (res.failed > 0 ? `（${res.failed} 位生成失败）` : ""),
      );
      setExpandedWeek(res.weekStart);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "周报生成失败");
    } finally {
      setGenerating(false);
    }
  }

  function toggleWeek(weekStart: string) {
    setExpandedWeek((current) => (current === weekStart ? null : weekStart));
  }

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <p className={shared.breadcrumb}>周报管理</p>
          <h1 className={styles.pageHeadTitle}>学习周报</h1>
        </div>
        <button
          type="button"
          className={shared.btnAccent}
          disabled={generating}
          onClick={() => void generate()}
        >
          {generating ? "生成中…" : "生成周报"}
        </button>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}
      {message ? <p className={shared.muted}>{message}</p> : null}

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : weeks.length === 0 ? (
        <div className={styles.empty}>
          暂无周报。点击「生成周报」为所有活跃雏英生成本周学习周报（AI 总结）。
        </div>
      ) : (
        <div className={shared.panel}>
          <h2 className={shared.sectionTitle}>已生成的周报</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>周次</th>
                  <th>学员数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <Fragment key={week.weekStart}>
                    <tr style={{ cursor: "pointer" }} onClick={() => toggleWeek(week.weekStart)}>
                      <td>{week.weekStart}</td>
                      <td>{week.reports.length} 人</td>
                      <td>
                        <div className={styles.inlineActions}>
                          <button type="button">
                            {expandedWeek === week.weekStart ? "收起详情" : "查看详情"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedWeek === week.weekStart ? (
                      <tr key={`${week.weekStart}-detail`}>
                        <td colSpan={3}>
                          <div className={shared.section}>
                            {week.reports.map((report) => (
                              <div
                                key={report.id}
                                className={shared.panel}
                                style={{ marginBottom: "var(--space-md)" }}
                              >
                                <div className={styles.inlineActions} style={{ justifyContent: "space-between" }}>
                                  <strong>{report.userDisplayName ?? `用户 #${report.userId}`}</strong>
                                  <span className={shared.muted}>
                                    报名 {report.enrollmentsCount} · 课程进度 {report.coursesProgressed} · 积分 +{report.pointsEarned} · 申请 {report.applicationsCount}
                                  </span>
                                </div>
                                {report.aiSummary ? (
                                  <p style={{ margin: "var(--space-sm) 0 0", lineHeight: 1.7 }}>
                                    {report.aiSummary}
                                  </p>
                                ) : (
                                  <p className={shared.muted} style={{ margin: "var(--space-sm) 0 0" }}>
                                    AI 总结生成失败，仅保存统计数据
                                  </p>
                                )}
                                <p className={shared.muted} style={{ margin: "var(--space-sm) 0 0", fontSize: "0.85rem" }}>
                                  生成于 {formatDateTime(report.createdAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
