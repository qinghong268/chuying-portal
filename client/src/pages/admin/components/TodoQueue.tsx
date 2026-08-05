import { Link } from "react-router-dom";
import { formatDateTime } from "../../../lib/datetime";
import styles from "./TodoQueue.module.css";

interface PendingJoin {
  id: number; name: string; contact: string; createdAt: number;
}

interface PendingPointApp {
  id: number; type: string; pointsRequested: number; createdAt: number;
  userDisplayName: string; aiScore?: number; aiAction?: string;
}

interface ActiveActivity {
  id: number; title: string; endAt: number; enrollmentCount: number;
}

interface Props {
  pendingJoins: PendingJoin[];
  pendingPointApps: PendingPointApp[];
  activeActivity?: ActiveActivity | null;
}

function aiRiskBadge(action?: string) {
  if (!action) return <span className={styles.riskNone}>⚪ 未评估</span>;
  switch (action) {
    case "approve": return <span className={styles.riskLow}>🟢 推荐通过</span>;
    case "review": return <span className={styles.riskMed}>🟡 建议复核</span>;
    case "reject": return <span className={styles.riskHigh}>🔴 建议驳回</span>;
    default: return <span className={styles.riskNone}>⚪ 未评估</span>;
  }
}

function waitTime(createdAt: number): string {
  const hours = Math.floor((Date.now() - createdAt) / 3600000);
  if (hours < 1) return "<1小时";
  if (hours < 24) return `${hours}小时`;
  return `${Math.floor(hours / 24)}天`;
}

export function TodoQueue({ pendingJoins, pendingPointApps, activeActivity }: Props) {
  return (
    <div className={styles.queue}>
      {/* 待审积分 */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3>待审积分 ({pendingPointApps.length})</h3>
          <Link to="/admin/point-apps?status=pending" className={styles.viewAll}>查看全部 →</Link>
        </div>
        {pendingPointApps.length === 0 ? (
          <p className={styles.empty}>暂无待审积分申请</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>申请人</th><th>类型</th><th>分值</th><th>等待</th><th>AI预审</th></tr></thead>
            <tbody>
              {pendingPointApps.map(app => (
                <tr key={app.id} className={styles.row}>
                  <td><Link to={`/admin/point-apps/${app.id}`}>{app.userDisplayName}</Link></td>
                  <td>{app.type === "type1" ? "心得" : "专项"}</td>
                  <td>{app.pointsRequested ?? "-"}</td>
                  <td>{waitTime(app.createdAt)}</td>
                  <td>{aiRiskBadge(app.aiAction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 待审加入 */}
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3>待审加入 ({pendingJoins.length})</h3>
          <Link to="/admin/join?status=pending" className={styles.viewAll}>查看全部 →</Link>
        </div>
        {pendingJoins.length === 0 ? (
          <p className={styles.empty}>暂无待审加入申请</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>姓名</th><th>邮箱</th><th>提交时间</th></tr></thead>
            <tbody>
              {pendingJoins.map(j => (
                <tr key={j.id} className={styles.row}>
                  <td><Link to={`/admin/join/${j.id}`}>{j.name}</Link></td>
                  <td>{j.contact}</td>
                  <td>{formatDateTime(j.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 进行中活动 */}
      {activeActivity ? (
        <div className={styles.section}>
          <h3>进行中活动</h3>
          <Link to={`/admin/activities/${activeActivity.id}/enrollments`} className={styles.activeLink}>
            {activeActivity.title} — {activeActivity.enrollmentCount}人报名
          </Link>
        </div>
      ) : null}
    </div>
  );
}
