import { useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./NotificationModal.module.css";

export interface NotificationData {
  upcomingActivities: Array<{
    id: number;
    title: string;
    start_at: number;
    mode: string;
  }>;
  inProgressCourses: Array<{ id: number; title: string; progress: number }>;
  pendingReflections: Array<{ id: number; title: string; end_at: number }>;
  closingWindows: Array<{
    id: number;
    title: string;
    point_apply_deadline: number;
  }>;
}

export function hasNotificationContent(data: NotificationData): boolean {
  return (
    data.upcomingActivities.length > 0 ||
    data.inProgressCourses.length > 0 ||
    data.pendingReflections.length > 0 ||
    data.closingWindows.length > 0
  );
}

export function NotificationModal({
  data,
  onClose,
}: {
  data: NotificationData;
  onClose: () => void;
}) {
  const hasContent = hasNotificationContent(data);

  // Guard against empty data arriving after mount; unmount without rendering.
  useEffect(() => {
    if (!hasContent) onClose();
  }, [hasContent, onClose]);

  if (!hasContent) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-label="学习提醒"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>📋 学习提醒</h2>
        {data.upcomingActivities.length > 0 ? (
          <div>
            <h4>📅 即将开始的活动</h4>
            {data.upcomingActivities.map((a) => (
              <p key={a.id}>
                {a.title} — {new Date(a.start_at).toLocaleDateString()}
              </p>
            ))}
          </div>
        ) : null}
        {data.inProgressCourses.length > 0 ? (
          <div>
            <h4>📺 课程学习中</h4>
            {data.inProgressCourses.map((c) => (
              <p key={c.id}>
                {c.title} — 进度 {c.progress}%{" "}
                <Link to={`/courses/${c.id}`} onClick={onClose}>
                  去学习
                </Link>
              </p>
            ))}
          </div>
        ) : null}
        {data.pendingReflections.length > 0 ? (
          <div>
            <h4>📝 待提交心得</h4>
            {data.pendingReflections.map((r) => (
              <p key={r.id}>{r.title}</p>
            ))}
          </div>
        ) : null}
        {data.closingWindows.length > 0 ? (
          <div>
            <h4>⏰ 积分申请即将截止</h4>
            {data.closingWindows.map((w) => (
              <p key={w.id}>{w.title}</p>
            ))}
          </div>
        ) : null}
        <button type="button" className={styles.okBtn} onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );
}
