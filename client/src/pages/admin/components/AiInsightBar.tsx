import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import styles from "./AiInsightBar.module.css";

interface InsightData {
  summary: string;
  alerts: string[];
  suggestions: string[];
  cached: boolean;
  generatedAt: number;
}

export function AiInsightBar() {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<InsightData>("/api/admin/ai-ops/insight");
      setInsight(data);
    } catch {
      setError("AI洞察暂时不可用");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function refresh() {
    await api("/api/admin/ai-ops/insight/refresh", { method: "POST" });
    await load();
  }

  if (collapsed) {
    return (
      <div className={styles.collapsed} onClick={() => setCollapsed(false)}>
        <span>📊 AI 运营洞察</span>
        <button className={styles.expandBtn}>展开</button>
      </div>
    );
  }

  return (
    <div className={styles.bar}>
      <div className={styles.header}>
        <span className={styles.title}>📊 AI 运营洞察</span>
        <div className={styles.actions}>
          <button onClick={refresh} disabled={loading} className={styles.btn}>刷新洞察</button>
          <button onClick={() => setCollapsed(true)} className={styles.btn}>收起</button>
        </div>
      </div>
      <div className={styles.content}>
        {loading ? (
          <p className={styles.loading}>AI 分析中...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : insight ? (
          <div className={styles.insightBody}>
            <p className={styles.summary}>{insight.summary}</p>
            {insight.alerts.length > 0 ? (
              <ul className={styles.alertList}>
                {insight.alerts.map((a, i) => <li key={i}>⚠️ {a}</li>)}
              </ul>
            ) : null}
            {insight.suggestions.length > 0 ? (
              <ul className={styles.suggestionList}>
                {insight.suggestions.map((s, i) => <li key={i}>💡 {s}</li>)}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className={styles.text}>暂无洞察数据</p>
        )}
      </div>
    </div>
  );
}
