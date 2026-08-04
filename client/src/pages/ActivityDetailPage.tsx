import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { ActivityDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import {
  formatDateTime,
  getActivityLifecycle,
  lifecycleLabel,
} from "../lib/datetime";
import shared from "./shared.module.css";
import styles from "./ActivityDetailPage.module.css";

export function ActivityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progressStr, setProgressStr] = useState("");

  const load = useCallback(async () => {
    const activityId = Number(id);
    if (!Number.isInteger(activityId) || activityId < 1) {
      setError("无效的活动编号");
      return;
    }
    try {
      const data = await api<{ activity: ActivityDetail }>(`/api/activities/${activityId}`);
      setActivity(data.activity);
      setProgressStr(String(data.activity.progressPercent ?? ""));
      setError(null);
    } catch (err) {
      setActivity(null);
      setError(err instanceof ApiError && err.status === 404 ? "活动不存在或未发布" : "加载失败");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  async function handleEnroll() {
    if (!activity) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/activities/${activity.id}`)}`);
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      await api(`/api/activities/${activity.id}/enroll`, { method: "POST" });
      setActionMsg("报名成功");
      await load();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : "报名失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleProgress() {
    if (!activity) return;
    const percent = progressStr === "" ? undefined : Number(progressStr);
    if (percent === undefined) {
      setActionMsg("请输入进度");
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      await api(`/api/activities/${activity.id}/progress`, {
        method: "PUT",
        body: JSON.stringify({ percent }),
      });
      setActionMsg("进度已更新");
      await load();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : "进度更新失败");
    } finally {
      setBusy(false);
    }
  }

  if (error && !activity) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.error}>{error}</p>
        <Link to="/activities" className={shared.btnSecondary}>
          返回活动列表
        </Link>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.muted}>加载中…</p>
      </div>
    );
  }

  const life = getActivityLifecycle(activity.startAt, activity.endAt);
  const isEagle = user?.role === "eagle";
  const enrolled = Boolean(activity.enrolled);
  const progress = activity.progressPercent ?? 0;
  // 线上与线下同规则：活动结束后 24 小时内（且在积分申请通道截止前）可申请心得
  const canApplyReflection = isEagle && enrolled && life === "ended";

  return (
    <div className={`${shared.page} ${shared.container}`}>
      <p className={shared.breadcrumb}>
        <Link to="/activities">活动</Link> / {activity.title}
      </p>

      <div className={styles.layout}>
        <article>
          {activity.mode === "online" && activity.videoUrl ? (
            <div className={styles.mediaBox}>
              <video
                className={styles.video}
                controls
                preload="metadata"
                src={activity.videoUrl}
              >
                你的浏览器不支持视频播放，请更换浏览器或
                <a href={activity.videoUrl}>下载观看</a>。
              </video>
            </div>
          ) : activity.mode === "offline" && activity.imageUrl ? (
            <div className={styles.mediaBox}>
              <img
                className={styles.coverImage}
                src={activity.imageUrl}
                alt={activity.title}
              />
            </div>
          ) : (
            <div className={styles.cover} aria-hidden="true" />
          )}
          <div className={styles.metaRow}>
            <span
              className={`${shared.tag} ${
                activity.mode === "online" ? shared.tagOnline : shared.tagOffline
              }`}
            >
              {activity.mode === "online" ? "线上" : "线下"}
            </span>
            <span
              className={`${shared.tag} ${
                life === "enrolling"
                  ? shared.tagEnrolling
                  : life === "ongoing"
                    ? shared.tagOngoing
                    : shared.tagEnded
              }`}
            >
              {lifecycleLabel(life)}
            </span>
          </div>
          <h1 className={styles.title}>{activity.title}</h1>
          <ul className={styles.infoList}>
            <li>时间：{formatDateTime(activity.startAt)} ~ {formatDateTime(activity.endAt)}</li>
            <li>目标积分：{activity.targetPoints}</li>
            <li>
              积分申请通道截止：
              {activity.pointApplyDeadline != null
                ? formatDateTime(activity.pointApplyDeadline)
                : "未设置"}
            </li>
          </ul>

          <section className={styles.prose}>
            <h2>活动介绍</h2>
            <p>{activity.description}</p>
          </section>

          <section className={styles.prose}>
            <h2>报名与积分规则摘要</h2>
            <ul>
              <li>线上与线下：活动开始前可报名</li>
              <li>
                积分申请：活动结束后 24 小时内、且须在积分申请通道截止前可提交心得
              </li>
              <li>心得正文 300–1000 字（在个人中心发起申请）</li>
            </ul>
          </section>
        </article>

        <aside className={`${shared.panel} ${styles.side}`}>
          <h2 className={styles.sideTitle}>报名与进度</h2>
          <dl>
            <div className={styles.sideRow}>
              <dt>形态</dt>
              <dd>{activity.mode === "online" ? "线上" : "线下"}</dd>
            </div>
            <div className={styles.sideRow}>
              <dt>我的状态</dt>
              <dd>
                {!user
                  ? "未登录"
                  : !isEagle
                    ? "非雏英账号"
                    : enrolled
                      ? "已报名"
                      : "未报名"}
              </dd>
            </div>
          </dl>

          {isEagle && enrolled && activity.mode === "online" ? (
            <div className={styles.progressBox}>
              <div className={styles.sideRow}>
                <dt>观看进度</dt>
                <dd>{progress}%</dd>
              </div>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <label className={shared.field} htmlFor="progress-input">
                更新进度（演示）
                <input
                  id="progress-input"
                  type="number"
                  min={0}
                  max={100}
                  value={progressStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || (/^\d+$/.test(v) && Number(v) <= 100)) {
                      setProgressStr(v);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className={shared.btnSecondary}
                disabled={busy}
                onClick={() => void handleProgress()}
              >
                保存进度
              </button>
            </div>
          ) : null}

          <div className={styles.actions}>
            {!user ? (
              <Link
                to={`/login?redirect=${encodeURIComponent(`/activities/${activity.id}`)}`}
                className={shared.btnPrimary}
              >
                去登录
              </Link>
            ) : null}

            {user && !isEagle ? (
              <p className={shared.muted}>管理员账号可浏览详情，前台报名仅限雏英。</p>
            ) : null}

            {isEagle && !enrolled ? (
              <button
                type="button"
                className={shared.btnPrimary}
                disabled={busy || !activity.canEnroll}
                onClick={() => void handleEnroll()}
              >
                {activity.canEnroll ? "立即报名" : "当前不可报名"}
              </button>
            ) : null}

            {!activity.canEnroll && activity.enrollBlockedReason ? (
              <p className={shared.muted}>{activity.enrollBlockedReason}</p>
            ) : null}

            {canApplyReflection ? (
              <Link
                to={`/me/applications/new?activityId=${activity.id}`}
                className={shared.btnAccent}
              >
                申请活动完成心得
              </Link>
            ) : isEagle && enrolled ? (
              <p className={shared.muted}>
                {activity.pointApplyDeadline != null
                  ? `活动结束后 24 小时内且须在 ${formatDateTime(activity.pointApplyDeadline)} 前可申请心得`
                  : "活动结束后 24 小时内可申请心得"}
              </p>
            ) : null}
          </div>

          {actionMsg ? <p className={shared.muted}>{actionMsg}</p> : null}
        </aside>
      </div>
    </div>
  );
}
