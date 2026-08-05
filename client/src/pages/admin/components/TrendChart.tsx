import { useState } from "react";
import styles from "./TrendChart.module.css";

interface DailyStat { date: string; enrollments: number; points: number; }

interface Props {
  dailyStats: DailyStat[];
  onDayClick?: (dayIndex: number) => void;
}

function BarChart({ data, color, label, maxY }: { data: Array<{date:string, value:number}>, color: string, label: string, maxY: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const chartH = 180;
  const padding = { top: 20, bottom: 24, left: 40, right: 16 };
  const w = 600 - padding.left - padding.right;
  const h = chartH - padding.top - padding.bottom;

  // Y-axis ticks (0, 25%, 50%, 75%, 100%)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => Math.round(p * maxY));

  return (
    <div className={styles.chartWrap}>
      <h4 className={styles.chartTitle}>{label}</h4>
      <svg viewBox={`0 0 600 ${chartH}`} className={styles.svg}>
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} y1={padding.top + h * (1 - i/4)} x2={600 - padding.right} y2={padding.top + h * (1 - i/4)} stroke="#e4e8f0" strokeWidth={0.5} />
            <text x={padding.left - 6} y={padding.top + h * (1 - i/4) + 4} textAnchor="end" fontSize={10} fill="#718096">{t}</text>
          </g>
        ))}
        {/* Bars */}
        {data.map((d, i) => {
          const barW = Math.max(4, w / data.length - 8);
          const barH = maxY > 0 ? (d.value / maxY) * h : 0;
          const x = padding.left + (i / data.length) * w + 4;
          const y = padding.top + h - barH;
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect x={x} y={y} width={barW} height={Math.max(1, barH)} fill={color} rx={3} opacity={hovered === i ? 1 : 0.8} />
              {hovered === i ? (
                <g>
                  <rect x={x - 10} y={y - 28} width={80} height={22} rx={4} fill="#1a1a2e" />
                  <text x={x + barW/2} y={y - 13} textAnchor="middle" fontSize={11} fill="white">{d.date}: {d.value}</text>
                </g>
              ) : null}
            </g>
          );
        })}
        {/* Date labels */}
        {data.map((d, i) => (
          <text key={i} x={padding.left + (i / data.length) * w + 4 + (w/data.length - 8)/2} y={chartH - 6} textAnchor="middle" fontSize={10} fill="#718096">{d.date}</text>
        ))}
      </svg>
    </div>
  );
}

export function TrendChart({ dailyStats, onDayClick }: Props) {
  const maxEnroll = Math.max(...dailyStats.map(d => d.enrollments), 1) * 1.2;
  const maxPoints = Math.max(...dailyStats.map(d => d.points), 1) * 1.2;

  const enrollData = dailyStats.map(d => ({ date: d.date, value: d.enrollments }));
  const pointsData = dailyStats.map(d => ({ date: d.date, value: d.points }));

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>近 7 日趋势</h3>
      <div className={styles.charts}>
        <BarChart data={enrollData} color="#1a5fb4" label="报名人数" maxY={maxEnroll} />
        <BarChart data={pointsData} color="#ff6b35" label="积分发放" maxY={maxPoints} />
      </div>
    </div>
  );
}
