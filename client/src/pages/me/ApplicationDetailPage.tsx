import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ActivityDetail, PointApplication, PointTemplate } from "../../api/types";
import { formatDateTime } from "../../lib/datetime";
import {
  applicationStatusLabel,
  applicationTypeLabel,
  formatApplicationNo,
} from "../../lib/meLabels";
import shared from "../shared.module.css";
import styles from "./me.module.css";

function statusBadgeClass(status: PointApplication["status"]): string {
  switch (status) {
    case "pending":
      return styles.badgePending;
    case "approved":
      return styles.badgeApproved;
    case "rejected":
      return styles.badgeRejected;
  }
}

export function ApplicationDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const [app, setApp] = useState<PointApplication | null>(null);
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null,
  );

  const load = useCallback(async () => {
    const appId = Number(id);
    if (!Number.isInteger(appId) || appId < 1) {
      setError("无效的申请编号");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ application: PointApplication }>(
        `/api/me/point-applications/${appId}`,
      );
      setApp(data.application);

      if (data.application.type === "type1" && data.application.activityId) {
        try {
          const actRes = await api<{ activity: ActivityDetail }>(
            `/api/activities/${data.application.activityId}`,
          );
          setActivity(actRes.activity);
        } catch {
          setActivity(null);
        }
      } else if (data.application.templateCode) {
        const tplRes = await api<{ templates: PointTemplate[] }>(
          "/api/point-type-templates?enabled=true",
        );
        const tpl = tplRes.templates.find((t) => t.code === data.application.templateCode);
        setTemplateName(tpl?.name ?? null);
      }
    } catch (err) {
      setApp(null);
      setError(
        err instanceof ApiError && err.status === 404
          ? "申请不存在"
          : "加载失败，请重试",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (loading) {
    return <p className={shared.muted}>加载中…</p>;
  }

  if (error || !app) {
    return (
      <>
        <p className={shared.error}>{error ?? "申请不存在"}</p>
        <Link to="/me/applications" className={shared.btnSecondary}>
          返回我的申请
        </Link>
      </>
    );
  }

  const reflection =
    app.type === "type1" && typeof app.payload.reflection === "string"
      ? app.payload.reflection
      : null;
  const matter =
    app.type === "type2" && typeof app.payload.title === "string"
      ? app.payload.title
      : null;
  const reason =
    app.type === "type2" && typeof app.payload.reason === "string"
      ? app.payload.reason
      : null;

  return (
    <>
      {toast ? (
        <p className={shared.muted} role="status">
          {toast}
        </p>
      ) : null}

      <div className={styles.pageHead}>
        <p className={shared.breadcrumb}>
          <Link to="/me">个人中心</Link> / <Link to="/me/applications">我的申请</Link> / 详情
        </p>
        <Link to="/me/applications" className={shared.btnGhost}>
          ← 返回我的申请
        </Link>
      </div>

      <div className={styles.detailHeader}>
        <div>
          <h2 className={shared.pageTitle}>{formatApplicationNo(app.id)}</h2>
          <p className={styles.detailMeta}>
            类型：{applicationTypeLabel(app.type, app.templateCode)} · 提交时间：
            {formatDateTime(app.createdAt)}
          </p>
        </div>
        <span className={`${styles.badge} ${statusBadgeClass(app.status)}`}>
          {applicationStatusLabel(app.status)}
        </span>
      </div>

      <section className={`${shared.panel} ${styles.contentBlock}`}>
        <h3>申请内容</h3>
        {app.type === "type1" ? (
          <>
            <p>
              <strong>关联活动：</strong>
              {activity ? (
                <Link to={`/activities/${activity.id}`}>{activity.title}</Link>
              ) : (
                `活动 #${app.activityId}`
              )}
            </p>
            {activity ? (
              <p className={shared.muted}>
                形态：{activity.mode === "online" ? "线上" : "线下"}
                {activity.mode === "online" && activity.progressPercent != null
                  ? ` · 提交时进度 ${activity.progressPercent}%`
                  : null}
              </p>
            ) : null}
            <p>
              <strong>申请分值（只读）：</strong>
              {app.pointsRequested ?? "—"}
            </p>
            {reflection ? (
              <div>
                <strong>心得全文</strong>
                <p className={styles.reflection}>{reflection}</p>
                <p className={shared.muted}>{reflection.length} 字</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p>
              <strong>模板：</strong>
              {templateName ?? app.templateCode ?? "—"}
            </p>
            <p>
              <strong>默认分值（只读）：</strong>
              {app.pointsRequested ?? "—"}
            </p>
            <p>
              <strong>具体事项：</strong>
              {matter ?? "—"}
            </p>
            <p>
              <strong>申请理由：</strong>
            </p>
            <p className={styles.reflection}>{reason ?? "—"}</p>
          </>
        )}
      </section>

      <section className={`${shared.panel} ${styles.contentBlock}`}>
        <h3>审批结果</h3>
        {app.status === "pending" ? (
          <p className={shared.muted}>审核中，请耐心等待</p>
        ) : null}
        {app.status === "approved" ? (
          <>
            <p>
              <strong>入账分值：</strong>
              {app.pointsGranted ?? "—"}
            </p>
            {app.reviewedAt ? (
              <p className={shared.muted}>审批时间：{formatDateTime(app.reviewedAt)}</p>
            ) : null}
            <Link to="/me/points" className={shared.btnGhost}>
              查看积分明细 →
            </Link>
          </>
        ) : null}
        {app.status === "rejected" ? (
          <>
            <p>
              <strong>驳回原因：</strong>
            </p>
            <p className={styles.reflection}>{app.rejectReason ?? "未提供原因"}</p>
            <Link
              to={`/me/applications/new?from=${app.id}`}
              className={shared.btnAccent}
            >
              修改后重新申请
            </Link>
            <p className={shared.muted}>重新提交将创建新申请，原单保持已驳回状态</p>
          </>
        ) : null}
      </section>
    </>
  );
}
