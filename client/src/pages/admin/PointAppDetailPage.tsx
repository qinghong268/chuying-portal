import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ApplicationStatus, ApplicationType } from "../../api/types";
import { api } from "../../api/client";
import {
  applicationStatusLabel,
  applicationTypeLabel,
  formatApplicationNo,
} from "../../lib/meLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface AdminPointApplication {
  id: number;
  userId: number;
  type: ApplicationType;
  activityId: number | null;
  courseId: number | null;
  templateCode: string | null;
  payload: Record<string, unknown>;
  status: ApplicationStatus;
  pointsRequested: number | null;
  pointsGranted: number | null;
  rejectReason: string | null;
  createdAt: number;
  reviewedAt: number | null;
}

export function PointAppDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AdminPointApplication | null>(null);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointsGranted, setPointsGranted] = useState("");
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ application: AdminPointApplication }>(
        `/api/admin/point-applications/${id}`,
      );
      setApp(res.application);
      setPointsGranted(String(res.application.pointsRequested ?? ""));
      if (res.application.courseId) {
        try {
          const courseRes = await api<{ course: { title: string } }>(
            `/api/courses/${res.application.courseId}`,
          );
          setCourseTitle(courseRes.course.title);
        } catch {
          setCourseTitle(null);
        }
      }
    } catch {
      setError("申请不存在或加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    if (!id) return;
    const pts = Number(pointsGranted);
    if (!Number.isInteger(pts) || pts < 1) {
      setError("请输入有效分值");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await api<{ application: AdminPointApplication }>(
        `/api/admin/point-applications/${id}/approve`,
        { method: "POST", body: JSON.stringify({ pointsGranted: pts }) },
      );
      setApp(res.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "审批失败");
    } finally {
      setActing(false);
    }
  }

  async function reject() {
    if (!id || reason.trim().length < 5) {
      setError("驳回原因至少 5 字");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const res = await api<{ application: AdminPointApplication }>(
        `/api/admin/point-applications/${id}/reject`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      setApp(res.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "驳回失败");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <p className={shared.muted}>加载中…</p>;
  if (!app) {
    return (
      <div className={shared.empty}>
        <p>{error ?? "申请不存在"}</p>
        <Link to="/admin/point-apps">返回列表</Link>
      </div>
    );
  }

  const reflection =
    typeof app.payload.reflection === "string" ? app.payload.reflection : null;
  const title = typeof app.payload.title === "string" ? app.payload.title : null;

  return (
    <>
      <p className={shared.breadcrumb}>
        <Link to="/admin/point-apps">积分审批</Link> / {formatApplicationNo(app.id)}
      </p>
      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageHeadTitle}>
            {applicationTypeLabel(app.type, app.templateCode)}
          </h1>
          <p className={styles.detailMeta}>
            {applicationStatusLabel(app.status)} · 用户 #{app.userId} · 提交于{" "}
            {formatDateTime(app.createdAt)}
          </p>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}

      <div className={shared.panel}>
        <div className={shared.formStack}>
          {title ? (
            <div>
              <strong>标题</strong>
              <p>{title}</p>
            </div>
          ) : null}
          {app.activityId ? (
            <div>
              <strong>关联活动</strong>
              <p>活动 #{app.activityId}</p>
            </div>
          ) : null}
          {app.courseId ? (
            <div>
              <strong>关联课程</strong>
              <p>
                {courseTitle ? `${courseTitle}（课程 #${app.courseId}）` : `课程 #${app.courseId}`}
              </p>
            </div>
          ) : null}
          {reflection ? (
            <div>
              <strong>心得</strong>
              <p className={styles.reflection}>{reflection}</p>
            </div>
          ) : null}
          <div>
            <strong>申请分值</strong>
            <p>{app.pointsRequested ?? "—"}</p>
          </div>
          {app.pointsGranted != null ? (
            <div>
              <strong>最终分值</strong>
              <p>+{app.pointsGranted}</p>
            </div>
          ) : null}
          {app.rejectReason ? (
            <div>
              <strong>驳回原因</strong>
              <p>{app.rejectReason}</p>
            </div>
          ) : null}
          <details>
            <summary>原始 payload</summary>
            <pre className={styles.readonly}>{JSON.stringify(app.payload, null, 2)}</pre>
          </details>
        </div>
      </div>

      {app.status === "pending" ? (
        <div className={shared.panel} style={{ marginTop: "var(--space-lg)" }}>
          <div className={shared.field}>
            <label htmlFor="grant-points">最终分值（可调整）</label>
            <input
              id="grant-points"
              type="number"
              min={1}
              max={9999}
              value={pointsGranted}
              onChange={(e) => setPointsGranted(e.target.value)}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="pa-reject">驳回原因</label>
            <textarea
              id="pa-reject"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className={shared.btnRow}>
            <button
              type="button"
              className={shared.btnPrimary}
              disabled={acting}
              onClick={() => void approve()}
            >
              通过并入账
            </button>
            <button
              type="button"
              className={shared.btnSecondary}
              disabled={acting}
              onClick={() => void reject()}
            >
              驳回
            </button>
            <button
              type="button"
              className={shared.btnGhost}
              onClick={() => navigate("/admin/point-apps")}
            >
              返回列表
            </button>
          </div>
        </div>
      ) : (
        <div className={shared.btnRow}>
          <Link to="/admin/point-apps" className={shared.btnSecondary}>
            返回列表
          </Link>
        </div>
      )}
    </>
  );
}
