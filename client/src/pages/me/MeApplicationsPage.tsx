import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import type { ActivitySummary, ApplicationStatus, ApplicationType, CourseSummary, PointApplication } from "../../api/types";
import { formatDateTime } from "../../lib/datetime";
import {
  applicationStatusLabel,
  applicationTypeLabel,
  formatApplicationNo,
} from "../../lib/meLabels";
import shared from "../shared.module.css";
import styles from "./me.module.css";

type StatusFilter = "all" | ApplicationStatus;
type TypeFilter = "all" | ApplicationType;

function statusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case "pending":
      return styles.badgePending;
    case "approved":
      return styles.badgeApproved;
    case "rejected":
      return styles.badgeRejected;
  }
}

function applicationSummary(
  app: PointApplication,
  activityTitles: Map<number, string>,
  courseTitles: Map<number, string>,
): string {
  if (app.type === "type1") {
    if (app.activityId) {
      return activityTitles.get(app.activityId) ?? "活动心得";
    }
    if (app.courseId) {
      return courseTitles.get(app.courseId) ?? "课程心得";
    }
    return "活动/课程心得";
  }
  const title = app.payload.title;
  return typeof title === "string" ? title : "专项申请";
}

export function MeApplicationsPage() {
  const [params] = useSearchParams();
  const [items, setItems] = useState<PointApplication[]>([]);
  const [activityTitles, setActivityTitles] = useState<Map<number, string>>(new Map());
  const [courseTitles, setCourseTitles] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>(
    (params.get("status") as StatusFilter) || "all",
  );
  const [type, setType] = useState<TypeFilter>("all");
  const [keyword, setKeyword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, activitiesRes, coursesRes] = await Promise.all([
        api<{ applications: PointApplication[] }>("/api/me/point-applications"),
        api<{ activities: ActivitySummary[] }>("/api/activities"),
        api<{ courses: CourseSummary[] }>("/api/courses"),
      ]);
      setItems(appsRes.applications);
      const actMap = new Map<number, string>();
      for (const a of activitiesRes.activities) {
        actMap.set(a.id, a.title);
      }
      setActivityTitles(actMap);
      const courseMap = new Map<number, string>();
      for (const c of coursesRes.courses) {
        courseMap.set(c.id, c.title);
      }
      setCourseTitles(courseMap);
    } catch {
      setError("申请列表加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((app) => {
      if (status !== "all" && app.status !== status) return false;
      if (type !== "all" && app.type !== type) return false;
      if (q) {
        const summary = applicationSummary(app, activityTitles, courseTitles).toLowerCase();
        const no = formatApplicationNo(app.id).toLowerCase();
        if (!summary.includes(q) && !no.includes(q)) return false;
      }
      return true;
    });
  }, [items, status, type, keyword, activityTitles, courseTitles]);

  return (
    <>
      <div className={styles.pageHead}>
        <h2 className={styles.pageHeadTitle}>我的申请</h2>
        <Link to="/me/applications/new" className={shared.btnAccent}>
          发起积分申请
        </Link>
      </div>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="app-status">状态</label>
          <select
            id="app-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">全部</option>
            <option value="pending">待审批</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
        <div className={shared.field}>
          <label htmlFor="app-type">类型</label>
          <select
            id="app-type"
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
          >
            <option value="all">全部</option>
            <option value="type1">活动/课程心得</option>
            <option value="type2">独立专项</option>
          </select>
        </div>
        <div className={`${shared.field} ${shared.fieldGrow}`}>
          <label htmlFor="app-q">关键词</label>
          <input
            id="app-q"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索摘要或编号"
          />
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
          <p>暂无积分申请</p>
          <p>完成活动或提交专项申请，积分会在这里汇总</p>
          <Link to="/me/applications/new" className={shared.btnAccent}>
            发起积分申请
          </Link>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>申请编号</th>
                <th>类型</th>
                <th>摘要</th>
                <th>提交时间</th>
                <th>状态</th>
                <th>分值</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id}>
                  <td>{formatApplicationNo(app.id)}</td>
                  <td>{applicationTypeLabel(app.type, app.templateCode)}</td>
                  <td>{applicationSummary(app, activityTitles, courseTitles)}</td>
                  <td>{formatDateTime(app.createdAt)}</td>
                  <td>
                    <span className={`${styles.badge} ${statusBadgeClass(app.status)}`}>
                      {applicationStatusLabel(app.status)}
                    </span>
                  </td>
                  <td>
                    {app.status === "approved" && app.pointsGranted != null
                      ? `+${app.pointsGranted}`
                      : "—"}
                  </td>
                  <td>
                    <Link to={`/me/applications/${app.id}`}>详情</Link>
                    {app.status === "rejected" ? (
                      <>
                        {" · "}
                        <Link to={`/me/applications/new?from=${app.id}`}>再申请</Link>
                      </>
                    ) : null}
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
