import styles from "./DetailDrawer.module.css";

interface EnrollmentItem { id: number; userName: string; activityTitle: string; }
interface LedgerItem { id: number; delta: number; description: string; }

interface DailyDetail {
  date: string;
  enrollments: EnrollmentItem[];
  ledger: LedgerItem[];
}

interface Props {
  dayIndex: number | null;
  dailyDetail: DailyDetail[];
  onClose: () => void;
}

export function DetailDrawer({ dayIndex, dailyDetail, onClose }: Props) {
  if (dayIndex === null || !dailyDetail[dayIndex]) return null;
  const detail = dailyDetail[dayIndex];

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h3>{detail.date} 明细</h3>
          <button onClick={onClose} className={styles.closeBtn}>✕</button>
        </div>

        <div className={styles.section}>
          <h4>报名 ({detail.enrollments.length})</h4>
          {detail.enrollments.length === 0 ? <p className={styles.empty}>当日无报名</p> : (
            <ul>
              {detail.enrollments.map(e => (
                <li key={e.id}>{e.userName} — {e.activityTitle}</li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <h4>积分流水 ({detail.ledger.length})</h4>
          {detail.ledger.length === 0 ? <p className={styles.empty}>当日无流水</p> : (
            <ul>
              {detail.ledger.map(l => (
                <li key={l.id} className={l.delta > 0 ? styles.positive : styles.negative}>
                  {l.delta > 0 ? "+" : ""}{l.delta} — {l.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
