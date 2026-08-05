import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { joinStatusLabel } from "../../lib/adminLabels";
import { formatDateTime } from "../../lib/datetime";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface JoinApplication {
  id: number;
  name: string;
  contact: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  reviewedAt: number | null;
  rejectReason: string | null;
}

interface ApprovedAccount {
  email: string;
  password: string;
}

export function JoinDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<JoinApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);
  const [account, setAccount] = useState<ApprovedAccount | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ application: JoinApplication }>(
        `/api/admin/join-applications/${id}`,
      );
      setApp(res.application);
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
    setActing(true);
    setError(null);
    try {
      const res = await api<{
        application: JoinApplication;
        account?: ApprovedAccount;
      }>(`/api/admin/join-applications/${id}/approve`, { method: "POST" });
      setApp(res.application);
      setAccount(res.account ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
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
      const res = await api<{ application: JoinApplication }>(
        `/api/admin/join-applications/${id}/reject`,
        { method: "POST", body: JSON.stringify({ reason: reason.trim() }) },
      );
      setApp(res.application);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <p className={shared.muted}>加载中…</p>;
  if (!app) {
    return (
      <div className={shared.empty}>
        <p>{error ?? "申请不存在"}</p>
        <Link to="/admin/join">返回列表</Link>
      </div>
    );
  }

  return (
    <>
      <p className={shared.breadcrumb}>
        <Link to="/admin/join">加入审核</Link> / 详情 #{app.id}
      </p>
      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.pageHeadTitle}>{app.name}</h1>
          <p className={styles.detailMeta}>
            {joinStatusLabel(app.status)} · 提交于 {formatDateTime(app.createdAt)}
          </p>
        </div>
      </div>

      {error ? <p className={shared.error}>{error}</p> : null}

      {account ? (
        <div className={`${shared.panel} ${styles.accountBox}`}>
          <h2 className={shared.sectionTitle}>雏英账号已开通</h2>
          <div className={shared.formStack}>
            <div>
              <strong>登录邮箱</strong>
              <p>{account.email}</p>
              <button type="button" className={shared.btnSecondary} style={{marginTop:4}}
                onClick={() => { void navigator.clipboard.writeText(account.email); }}>
                复制邮箱
              </button>
            </div>
            <div>
              <strong>初始密码</strong>
              <p style={{fontFamily:"monospace",fontSize:"1.1rem",letterSpacing:1}}>{account.password}</p>
              <button type="button" className={shared.btnAccent} style={{marginTop:4}}
                onClick={() => { void navigator.clipboard.writeText(account.password); }}>
                复制密码
              </button>
            </div>
            <p className={shared.muted}>
              请立即将以上账号信息告知申请人。密码仅在此显示一次，离开后不可再查。
            </p>
          </div>
        </div>
      ) : null}

      <div className={shared.panel}>
        <div className={shared.formStack}>
          <div>
            <strong>联系方式</strong>
            <p>{app.contact}</p>
          </div>
          <div>
            <strong>留言</strong>
            <p className={styles.reflection}>{app.message}</p>
          </div>
          {app.rejectReason ? (
            <div>
              <strong>驳回原因</strong>
              <p>{app.rejectReason}</p>
            </div>
          ) : null}
          {app.reviewedAt ? (
            <p className={shared.muted}>审核于 {formatDateTime(app.reviewedAt)}</p>
          ) : null}
        </div>
      </div>

      {app.status === "pending" ? (
        <div className={shared.panel} style={{ marginTop: "var(--space-lg)" }}>
          <div className={shared.field}>
            <label htmlFor="reject-reason">驳回原因（驳回时必填）</label>
            <textarea
              id="reject-reason"
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
              通过
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
              onClick={() => navigate("/admin/join")}
            >
              返回列表
            </button>
          </div>
        </div>
      ) : (
        <div className={shared.btnRow}>
          <Link to="/admin/join" className={shared.btnSecondary}>
            返回列表
          </Link>
        </div>
      )}
    </>
  );
}
