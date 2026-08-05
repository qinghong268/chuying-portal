import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import shared from "../pages/shared.module.css";
import styles from "./EagleProfile.module.css";

export interface RadarDimension {
  label: string;
  value: number;
  earned: number;
}

export interface Milestone {
  date: number;
  event: string;
}

export interface EagleProfileData {
  radar: RadarDimension[];
  milestones: Milestone[];
  stats: {
    totalPoints: number;
    enrollmentCount: number;
    courseCount: number;
    appCount: number;
    joinDate: number;
  };
}

const SIZE = 340;
const CENTER = SIZE / 2;
const RADIUS = 102;
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1];

function polarPoint(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function polygonPoints(
  dimensions: RadarDimension[],
  frac: number,
  valueOf?: (d: RadarDimension) => number,
) {
  return dimensions
    .map((d, i) => {
      const f = valueOf ? frac * (valueOf(d) / 100) : frac;
      const p = polarPoint(i, dimensions.length, RADIUS * f);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

function RadarChart({ dimensions }: { dimensions: RadarDimension[] }) {
  if (dimensions.length === 0) {
    return <p className={shared.muted}>暂无画像数据。</p>;
  }

  const n = dimensions.length;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={styles.radarSvg}
      role="img"
      aria-label="学习维度雷达图"
    >
      {/* Grid rings at 25/50/75/100% */}
      {RING_FRACTIONS.map((frac) => (
        <polygon
          key={frac}
          points={polygonPoints(dimensions, frac)}
          fill="none"
          stroke="var(--color-border-neutral)"
          strokeWidth={1}
          strokeDasharray={frac === 1 ? undefined : "3 4"}
        />
      ))}

      {/* Axes */}
      {dimensions.map((_, i) => {
        const p = polarPoint(i, n, RADIUS);
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={p.x}
            y2={p.y}
            stroke="var(--color-border-neutral)"
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polygonPoints(dimensions, 1, (d) => d.value)}
        fill="var(--color-primary)"
        fillOpacity={0.16}
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {dimensions.map((d, i) => {
        const p = polarPoint(i, n, RADIUS * (d.value / 100));
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="var(--color-primary)"
            stroke="#fff"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Labels around the outside */}
      {dimensions.map((d, i) => {
        const p = polarPoint(i, n, RADIUS + 26);
        const cos = Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n);
        const anchor = cos < -0.25 ? "end" : cos > 0.25 ? "start" : "middle";
        const x = Math.max(4, Math.min(SIZE - 4, p.x));
        const y =
          cos === 0 && Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / n) < 0
            ? p.y - 2
            : p.y;
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className={styles.radarLabel}
          >
            {d.label}
          </text>
        );
      })}

      {/* Value percentages near each vertex */}
      {dimensions.map((d, i) => {
        const p = polarPoint(i, n, Math.max(RADIUS * (d.value / 100) - 14, 10));
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.radarValue}
          >
            {d.value}%
          </text>
        );
      })}
    </svg>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function EagleProfile() {
  const [data, setData] = useState<EagleProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await api<EagleProfileData>("/api/me/profile");
      setData(profile);
    } catch {
      setError("学习画像加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={styles.profile}>
        <div className={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeleton} style={{ width: "40%" }} />
              <div className={styles.skeleton} style={{ width: "60%", height: "2rem" }} />
            </div>
          ))}
        </div>
        <div className={styles.skeleton} style={{ width: "100%", height: "22rem" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.profile}>
        <div className={shared.btnRow}>
          <p className={shared.error}>{error}</p>
          <button
            type="button"
            className={shared.btnSecondary}
            onClick={() => void load()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const { radar, milestones, stats } = data;

  return (
    <div className={styles.profile}>
      <div className={styles.profileHead}>
        <p className={shared.muted}>
          {stats.joinDate ? `加入于 ${formatDate(stats.joinDate)}` : ""}
          {stats.joinDate && radar.length ? " · " : ""}
          {radar.length ? `学习维度覆盖 ${radar.length} 个类别` : ""}
        </p>
      </div>

      <div className={styles.statsGrid}>
        <div className={`${shared.panel} ${styles.statCard}`}>
          <span className={styles.statLabel}>总积分</span>
          <span className={styles.statValue}>{stats.totalPoints}</span>
        </div>
        <div className={`${shared.panel} ${styles.statCard}`}>
          <span className={styles.statLabel}>报名活动</span>
          <span className={styles.statValue}>{stats.enrollmentCount}</span>
        </div>
        <div className={`${shared.panel} ${styles.statCard}`}>
          <span className={styles.statLabel}>课程学习</span>
          <span className={styles.statValue}>{stats.courseCount}</span>
        </div>
        <div className={`${shared.panel} ${styles.statCard}`}>
          <span className={styles.statLabel}>申请次数</span>
          <span className={styles.statValue}>{stats.appCount}</span>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <section className={`${shared.panel} ${styles.radarPanel}`}>
          <h3 className={styles.panelTitle}>学习维度</h3>
          <RadarChart dimensions={radar} />
          <p className={shared.muted}>
            各维度按「已获积分 / 目标积分」折算为 0-100% 达成率。
          </p>
        </section>

        <section className={`${shared.panel} ${styles.timelinePanel}`}>
          <h3 className={styles.panelTitle}>成长足迹</h3>
          {milestones.length === 0 ? (
            <p className={shared.muted}>暂无里程碑记录，快去参加活动吧。</p>
          ) : (
            <ul className={styles.timeline}>
              {milestones.map((m, i) => (
                <li key={`${m.date}-${i}`} className={styles.timelineItem}>
                  <div className={styles.timelineRail}>
                    <span className={styles.timelineDot} />
                    {i < milestones.length - 1 ? (
                      <span className={styles.timelineLine} />
                    ) : null}
                  </div>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineEvent}>{m.event}</span>
                    <span className={shared.muted}>{formatDate(m.date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
