import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ActivitySummary } from "../api/types";
import {
  formatDateRange,
  getActivityLifecycle,
  lifecycleLabel,
  type ActivityLifecycle,
} from "../lib/datetime";
import shared from "./shared.module.css";

type ModeFilter = "all" | "online" | "offline";
type StatusFilter = "all" | ActivityLifecycle;

export function ActivitiesPage() {
  const [items, setItems] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api<{ activities: ActivitySummary[] }>("/api/activities");
        if (!cancelled) setItems(data.activities);
      } catch {
        if (!cancelled) setError("活动列表加载失败，请稍后重试。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return items.filter((item) => {
      if (mode !== "all" && item.mode !== mode) return false;
      const life = getActivityLifecycle(item.startAt, item.endAt);
      if (status !== "all" && life !== status) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [items, mode, status, keyword]);

  return (
    <div className={`${shared.page} ${shared.container}`}>
      <header>
        <h1 className={shared.pageTitle}>活动</h1>
        <p className={shared.lead}>
          浏览已发布的线上/线下活动，进入详情了解规则并报名。
        </p>
      </header>

      <div className={shared.filters}>
        <div className={shared.field}>
          <label htmlFor="mode-filter">形态</label>
          <select
            id="mode-filter"
            value={mode}
            onChange={(e) => setMode(e.target.value as ModeFilter)}
          >
            <option value="all">全部</option>
            <option value="online">线上</option>
            <option value="offline">线下</option>
          </select>
        </div>
        <div className={shared.field}>
          <label htmlFor="status-filter">状态</label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">全部</option>
            <option value="enrolling">报名中</option>
            <option value="ongoing">进行中</option>
            <option value="ended">已结束</option>
          </select>
        </div>
        <div className={`${shared.field} ${shared.fieldGrow}`}>
          <label htmlFor="activity-search">搜索</label>
          <input
            id="activity-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索关键词"
          />
        </div>
      </div>

      {loading ? <p className={shared.muted}>加载中…</p> : null}
      {error ? <p className={shared.error}>{error}</p> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className={shared.empty}>暂无符合条件的活动。</div>
      ) : null}

      <div className={shared.cardGrid}>
        {filtered.map((item) => {
          const life = getActivityLifecycle(item.startAt, item.endAt);
          return (
            <Link key={item.id} to={`/activities/${item.id}`} className={shared.card}>
              <div className={shared.cardMedia} />
              <div className={shared.cardBody}>
                <h2 className={shared.cardTitle}>{item.title}</h2>
                <div className={shared.cardMeta}>
                  <span
                    className={`${shared.tag} ${
                      item.mode === "online" ? shared.tagOnline : shared.tagOffline
                    }`}
                  >
                    {item.mode === "online" ? "线上" : "线下"}
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
                <p className={shared.cardDesc}>{formatDateRange(item.startAt, item.endAt)}</p>
                <p className={shared.cardDesc}>{item.description}</p>
                <span className={shared.btnGhost}>查看详情 →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
