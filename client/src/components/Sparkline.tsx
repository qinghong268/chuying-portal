interface SparklineProps {
  data: Array<{ date: string; value: number }>;
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ data, width = 80, height = 24, color = "#1a5fb4" }: SparklineProps) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = 0;
  const range = maxVal - minVal || 1;

  const padding = 2;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((d.value - minVal) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const lastPoint = data[data.length - 1];
  const lastX = padding + ((data.length - 1) / (data.length - 1)) * w;
  const lastY = padding + h - ((lastPoint.value - minVal) / range) * h;

  // Fill area under the line
  const fillPoints = `${padding},${padding + h} ${points} ${lastX},${padding + h}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polygon points={fillPoints} fill={`${color}15`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

/** Flat all-zeros sparkline, shown while a real series is still loading. */
export function SparklineEmpty(props: Omit<SparklineProps, "data">) {
  const emptyData = Array.from({ length: 7 }, (_, i) => ({
    date: `day-${i + 1}`,
    value: 0,
  }));
  return <Sparkline data={emptyData} {...props} />;
}
