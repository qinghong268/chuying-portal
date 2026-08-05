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

interface AiReview {
  score: number;
  relevance: number;
  suggestion: string;
  recommendedAction: "approve" | "reject" | "review";
  suggestedPoints: number | null;
  draftRejectReason: string | null;
  createdAt: number;
}

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
  reviewerId: number | null;
  createdAt: number;
  reviewedAt: number | null;
  userDisplayName: string | null;
  userEmail: string | null;
  activityTitle: string | null;
  activityMode: "online" | "offline" | null;
  courseTitle: string | null;
  aiReview: AiReview | null;
}

function recommendedActionLabel(action: AiReview["recommendedAction"]): string {
  switch (action) {
    case "approve":
      return "建议通过";
    case "reject":
      return "建议驳回";
    case "review":
      return "建议人工复核";
  }
}

function recommendedActionBadge(action: AiReview["recommendedAction"]): string {
  switch (action) {
    case "approve":
      return styles.badgeApproved;
    case "reject":
      return styles.badgeRejected;
    case "review":
      return styles.badgePending;
  }
}

export function PointAppDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<AdminPointApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pointsGranted, setPointsGranted] = useState("");
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
      setAiReview(res.application.aiReview ?? null);
    } catch {
      setError("申请不存在或加载失败");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateAiReview() {
    if (!id) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api<{ aiReview: AiReview }>(
        `/api/admin/point-applications/${id}/ai-review`,
        { method: "POST" },
      );
      setAiReview(res.aiReview);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI 审核生成失败");
    } finally {
      setAiLoading(false);
    }
  }

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
            {applicationStatusLabel(app.status)} ·{" "}
            {app.userDisplayName ?? `用户 #${app.userId}`} · 提交于{" "}
            {formatDateTime(app.createdAt)}
          </p>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}

      <div className={shared.panel}>
        <div className={shared.formStack}>
          <div>
            <strong>申请人</strong>
            <p>
              {app.userDisplayName ?? `用户 #${app.userId}`}
              {app.userEmail ? `（${app.userEmail}）` : ""}
            </p>
          </div>
          {title ? (
            <div>
              <strong>标题</strong>
              <p>{title}</p>
            </div>
          ) : null}
          {app.activityId ? (
            <div>
              <strong>关联活动</strong>
              <p>
                {app.activityTitle ?? `活动 #${app.activityId}`}
                {app.activityMode
                  ? `（${app.activityMode === "online" ? "线上" : "线下"}）`
                  : ""}
              </p>
            </div>
          ) : null}
          {app.courseId ? (
            <div>
              <strong>关联课程</strong>
              <p>
                {app.courseTitle ? `${app.courseTitle}（课程 #${app.courseId}）` : `课程 #${app.courseId}`}
              </p>
            </div>
          ) : null}
          {reflection ? (
            <div>
              <strong>心得（{reflection.length} 字）</strong>
              <p className={styles.reflection}>{reflection}</p>
            </div>
          ) : null}
          <div>
            <strong>申请分值</strong>
            <p>{app.pointsRequested ?? "—"}</p>
          </div>
          {app.status !== "pending" && app.reviewedAt != null ? (
            <div>
              <strong>审批信息</strong>
              <p>
                审批人 #{app.reviewerId ?? "—"} · {formatDateTime(app.reviewedAt)}
                {app.pointsGranted != null ? ` · 分值 +${app.pointsGranted}` : ""}
              </p>
            </div>
          ) : null}
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

      <details
        className={`${shared.panel} ${styles.aiDetails}`}
        open={aiReview != null || aiLoading || aiError != null}
      >
        <summary className={styles.aiSummary}>
          <span>AI 参考意见</span>
          <button
            type="button"
            className={shared.btnSecondary}
            disabled={aiLoading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void generateAiReview();
            }}
          >
            {aiLoading ? "生成中…" : aiReview ? "重新生成建议" : "生成 AI 建议"}
          </button>
        </summary>
        <div className={styles.aiBody}>
          {aiError ? <p className={shared.error}>{aiError}</p> : null}
          {aiLoading ? (
            <p className={shared.muted}>AI 正在审核心得，可能需要几秒钟…</p>
          ) : aiReview ? (
            <>
              <div className={styles.aiScoreRow}>
                <span className={styles.aiScoreLabel}>质量评分</span>
                <div className={styles.aiScoreBar}>
                  <div
                    className={styles.aiScoreFill}
                    style={{ width: `${aiReview.score * 10}%` }}
                  />
                </div>
                <span className={styles.aiScoreValue}>{aiReview.score}/10</span>
              </div>
              <div className={styles.aiScoreRow}>
                <span className={styles.aiScoreLabel}>主题相关度</span>
                <div className={styles.aiScoreBar}>
                  <div
                    className={styles.aiScoreFill}
                    style={{ width: `${aiReview.relevance * 10}%` }}
                  />
                </div>
                <span className={styles.aiScoreValue}>{aiReview.relevance}/10</span>
              </div>
              <div>
                <strong>审核建议</strong>
                <p>{aiReview.suggestion}</p>
              </div>
              <div>
                <strong>推荐处理</strong>
                <p>
                  <span
                    className={`${styles.badge} ${recommendedActionBadge(aiReview.recommendedAction)}`}
                  >
                    {recommendedActionLabel(aiReview.recommendedAction)}
                  </span>
                </p>
              </div>
              {aiReview.suggestedPoints != null ? (
                <div>
                  <strong>建议积分</strong>
                  <p>{aiReview.suggestedPoints}</p>
                </div>
              ) : null}
              {aiReview.draftRejectReason ? (
                <div>
                  <strong>驳回原因草稿</strong>
                  <p>{aiReview.draftRejectReason}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className={shared.muted}>
              点击「生成 AI 建议」，由 DeepSeek 辅助审核该申请。
            </p>
          )}
          <p className={styles.aiWarning}>
            AI 建议仅供参考，最终审核决策由管理员做出。
          </p>
        </div>
      </details>

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
