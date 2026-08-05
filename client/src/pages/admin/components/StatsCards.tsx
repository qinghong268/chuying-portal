import { Link } from "react-router-dom";
import { Sparkline } from "../../../components/Sparkline";
import styles from "./StatsCards.module.css";

interface SparklinePoint {
  date: string;
  value: number;
}

interface Props {
  eagleCount: number;
  pendingJoinCount: number;
  pendingPointAppCount: number;
  activeActivityCount: number;
  enrollmentsLast7d: number;
  ledgerPointsLast7d: number;
  ledgerCountLast7d: number;
  prevWeek?: { enrollments: number; points: number; ledgerCount: number } | null;
  sparklines?: { enrollments: SparklinePoint[]; points: SparklinePoint[] } | null;
}

function deltaText(current: number, prev: number): { text: string; up: boolean } {
  if (prev === 0) return { text: "新增", up: true };
  const diff = current - prev;
  const pct = Math.round((diff / prev) * 100);
  const arrow = diff >= 0 ? "↗" : "↘";
  return { text: `${arrow} ${Math.abs(pct)}%`, up: diff >= 0 };
}

function card(
  link: string,
  label: string,
  value: number,
  prevVal?: number,
  sparkData?: SparklinePoint[],
  color?: string
) {
  const delta = prevVal !== undefined ? deltaText(value, prevVal) : null;
  return (
    <Link to={link} className={styles.statCard} key={label}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.valueRow}>
        <div className={styles.statValue}>{value}</div>
        {delta ? (
          <span className={delta.up ? styles.deltaUp : styles.deltaDown}>{delta.text}</span>
        ) : null}
      </div>
      {sparkData ? (
        <div className={styles.spark}>
          <Sparkline data={sparkData} color={color || "#1a5fb4"} />
        </div>
      ) : null}
    </Link>
  );
}

export function StatsCards(props: Props) {
  return (
    <div className={styles.statsGrid}>
      {card("/admin/users?role=eagle&status=active", "活跃雏英", props.eagleCount, undefined, props.sparklines?.enrollments)}
      {card("/admin/join?status=pending", "待审加入", props.pendingJoinCount)}
      {card("/admin/point-apps?status=pending", "待审积分", props.pendingPointAppCount)}
      {card("/admin/activities", "进行中活动", props.activeActivityCount)}
      {card("/admin/activities", "近7日报名", props.enrollmentsLast7d, props.prevWeek?.enrollments, props.sparklines?.enrollments)}
      {card("/admin/point-apps", "近7日积分发放", props.ledgerPointsLast7d, props.prevWeek?.points, props.sparklines?.points, "#ff6b35")}
    </div>
  );
}
