import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { CourseSummary } from "../api/types";
import shared from "./shared.module.css";

export function CoursesPage() {
  const [items, setItems] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api<{ courses: CourseSummary[] }>("/api/courses");
        if (!cancelled) setItems(data.courses);
      } catch {
        if (!cancelled) setError("课程列表加载失败，请稍后重试。");
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
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }, [items, keyword]);

  return (
    <div className={`${shared.page} ${shared.container}`}>
      <header>
        <h1 className={shared.pageTitle}>课程</h1>
        <p className={shared.lead}>浏览已发布课程，进入详情了解内容说明。</p>
      </header>

      <div className={shared.filters}>
        <div className={`${shared.field} ${shared.fieldGrow}`}>
          <label htmlFor="course-search">搜索</label>
          <input
            id="course-search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索课程"
          />
        </div>
      </div>

      {loading ? <p className={shared.muted}>加载中…</p> : null}
      {error ? <p className={shared.error}>{error}</p> : null}

      {!loading && !error && filtered.length === 0 ? (
        <div className={shared.empty}>暂无符合条件的课程。</div>
      ) : null}

      <div className={shared.cardGrid}>
        {filtered.map((item) => (
          <Link key={item.id} to={`/courses/${item.id}`} className={shared.card}>
            {item.coverUrl ? (
              <img className={shared.cardMediaImage} src={item.coverUrl} alt={item.title} />
            ) : (
              <div className={shared.cardMedia} />
            )}
            <div className={shared.cardBody}>
              <h2 className={shared.cardTitle}>{item.title}</h2>
              {item.featured ? <span className={shared.tag}>精选</span> : null}
              <p className={shared.cardDesc}>{item.description}</p>
              <span className={shared.btnGhost}>查看详情 →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
