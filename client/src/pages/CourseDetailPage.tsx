import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as chuyingShared from "@chuying/shared";
import { api, ApiError } from "../api/client";
import type { CourseDetail } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import shared from "./shared.module.css";
import styles from "./CourseDetailPage.module.css";

const WATCH_PROGRESS_THRESHOLD = chuyingShared.WATCH_PROGRESS_THRESHOLD ?? 99;

export function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [progressInput, setProgressInput] = useState(0);

  const load = useCallback(async () => {
    const courseId = Number(id);
    if (!Number.isInteger(courseId) || courseId < 1) {
      setError("无效的课程编号");
      return;
    }
    try {
      const data = await api<{ course: CourseDetail }>(`/api/courses/${courseId}`);
      setCourse(data.course);
      setProgressInput(data.course.progressPercent ?? 0);
      setError(null);
    } catch (err) {
      setCourse(null);
      setError(
        err instanceof ApiError && err.status === 404
          ? "课程不存在或未发布"
          : "加载失败",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  async function handleEnroll() {
    if (!course) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/courses/${course.id}`)}`);
      return;
    }
    setBusy(true);
    setActionMsg(null);
    try {
      await api(`/api/courses/${course.id}/enroll`, { method: "POST" });
      setActionMsg("报名成功，开始学习吧");
      await load();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : "报名失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleProgress() {
    if (!course) return;
    setBusy(true);
    setActionMsg(null);
    try {
      await api(`/api/courses/${course.id}/progress`, {
        method: "PUT",
        body: JSON.stringify({ percent: progressInput }),
      });
      setActionMsg("进度已更新");
      await load();
    } catch (err) {
      setActionMsg(err instanceof ApiError ? err.message : "进度更新失败");
    } finally {
      setBusy(false);
    }
  }

  if (error && !course) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.error}>{error}</p>
        <Link to="/courses" className={shared.btnSecondary}>
          返回课程列表
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.muted}>加载中…</p>
      </div>
    );
  }

  const isEagle = user?.role === "eagle";
  const enrolled = Boolean(course.enrolled);
  const progress = course.progressPercent ?? 0;
  const canApplyReflection = isEagle && enrolled && progress >= WATCH_PROGRESS_THRESHOLD;

  return (
    <div className={`${shared.page} ${shared.container}`}>
      <p className={shared.breadcrumb}>
        <Link to="/courses">课程</Link> / {course.title}
      </p>

      {course.videoUrl ? (
        <div className={styles.mediaBox}>
          <video className={styles.video} controls preload="metadata" src={course.videoUrl}>
            你的浏览器不支持视频播放，请更换浏览器或<a href={course.videoUrl}>下载观看</a>。
          </video>
        </div>
      ) : course.coverUrl ? (
        <div className={styles.mediaBox}>
          <img className={styles.coverImage} src={course.coverUrl} alt={course.title} />
        </div>
      ) : (
        <div className={styles.cover} aria-hidden="true" />
      )}

      <div className={shared.cardMeta}>
        {course.featured ? <span className={shared.tag}>精选</span> : null}
        <span className={shared.tag}>课程</span>
      </div>
      <h1 className={shared.pageTitle}>{course.title}</h1>

      <section className={styles.prose}>
        <h2>课程说明</h2>
        <p>{course.description}</p>
        <p className={shared.muted}>
          课程为随时可看的视频：报名后随时观看，学习进度达到 {WATCH_PROGRESS_THRESHOLD}%
          后可申请心得积分。
        </p>
      </section>

      <div className={`${shared.panel} ${styles.side}`}>
        <h2 className={styles.sideTitle}>学习与积分</h2>
        <dl>
          <div className={styles.sideRow}>
            <dt>我的状态</dt>
            <dd>
              {!user ? "未登录" : !isEagle ? "非雏英账号" : enrolled ? "已报名" : "未报名"}
            </dd>
          </div>
        </dl>

        {isEagle && enrolled ? (
          <div className={styles.progressBox}>
            <div className={styles.sideRow}>
              <dt>学习进度</dt>
              <dd>{progress}%</dd>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <label className={shared.field} htmlFor="course-progress-input">
              更新进度
              <input
                id="course-progress-input"
                type="number"
                min={0}
                max={100}
                value={progressInput}
                onChange={(e) => setProgressInput(Number(e.target.value))}
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
              to={`/login?redirect=${encodeURIComponent(`/courses/${course.id}`)}`}
              className={shared.btnPrimary}
            >
              去登录
            </Link>
          ) : null}

          {user && !isEagle ? (
            <p className={shared.muted}>管理员账号可浏览详情，报名学习仅限雏英。</p>
          ) : null}

          {isEagle && !enrolled ? (
            <button
              type="button"
              className={shared.btnPrimary}
              disabled={busy}
              onClick={() => void handleEnroll()}
            >
              报名学习
            </button>
          ) : null}

          {canApplyReflection ? (
            <Link
              to={`/me/applications/new?courseId=${course.id}`}
              className={shared.btnAccent}
            >
              申请课程心得积分
            </Link>
          ) : isEagle && enrolled ? (
            <p className={shared.muted}>
              学习进度达到 {WATCH_PROGRESS_THRESHOLD}% 后可申请心得积分
            </p>
          ) : null}
        </div>

        {actionMsg ? <p className={shared.muted}>{actionMsg}</p> : null}
      </div>

      <div className={shared.btnRow}>
        <Link to="/courses" className={shared.btnSecondary}>
          返回列表
        </Link>
      </div>
    </div>
  );
}
