import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ActivitySummary, ContentBlock, CourseSummary } from "../api/types";
import {
  formatDateRange,
  getActivityLifecycle,
  lifecycleLabel,
} from "../lib/datetime";
import shared from "./shared.module.css";
import styles from "./HomePage.module.css";

const DEFAULT_HERO = {
  title: "雏英计划",
  headline: "面向青年人才的 SoftTong 培养门户",
  body: "了解计划、参与活动与课程，开启成长路径。宣传素材由运营团队后续补充。",
};

export function HomePage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        api<{ blocks: ContentBlock[] }>("/api/content/home"),
        api<{ activities: ActivitySummary[] }>("/api/activities/featured?limit=3"),
        api<{ courses: CourseSummary[] }>("/api/courses/featured?limit=3"),
      ]);
      if (cancelled) return;

      const home =
        results[0].status === "fulfilled" ? results[0].value : { blocks: [] };
      const featuredActs =
        results[1].status === "fulfilled"
          ? results[1].value
          : { activities: [] as ActivitySummary[] };
      const featuredCourses =
        results[2].status === "fulfilled"
          ? results[2].value
          : { courses: [] as CourseSummary[] };

      if (results.some((r) => r.status === "rejected")) {
        setError("首页部分内容加载失败，已展示可用内容与默认宣传文案。");
      }
      setBlocks(home.blocks);
      setActivities(featuredActs.activities.slice(0, 3));
      setCourses(featuredCourses.courses.slice(0, 3));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The hero block stays the FIRST element: prefer home_hero, else first block.
  const heroBlock = useMemo(() => {
    if (blocks.length === 0) return null;
    return blocks.find((b) => b.key === "home_hero") ?? blocks[0];
  }, [blocks]);

  const hero = {
    title: heroBlock?.title || DEFAULT_HERO.title,
    headline: DEFAULT_HERO.headline,
    body: heroBlock?.body || DEFAULT_HERO.body,
  };

  // Render the remaining blocks dynamically below the hero.
  const contentBlocks = heroBlock
    ? blocks.filter((b) => b.key !== heroBlock.key)
    : blocks;

  return (
    <div className={shared.page}>
      <section className={styles.hero} aria-label="首页首屏">
        <div className={styles.heroInner}>
          <p className={styles.brand}>{hero.title || "雏英计划"}</p>
          <h1 className={styles.headline}>{hero.headline}</h1>
          <p className={styles.subcopy}>{hero.body}</p>
          <div className={styles.ctaRow}>
            <Link to="/join" className={styles.ctaAccent}>
              加入我们
            </Link>
            <Link to="/activities" className={styles.ctaSecondary}>
              查看活动
            </Link>
            {heroBlock?.linkUrl ? (
              <a
                href={heroBlock.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.ctaLink}
              >
                {heroBlock.linkLabel || "了解更多"}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <div className={shared.container}>
        {error ? <p className={shared.error}>{error}</p> : null}

        {contentBlocks.map((block) => (
          <section
            key={block.key}
            id={block.key}
            className={shared.section}
            aria-labelledby={`block-${block.key}`}
          >
            <h2 id={`block-${block.key}`} className={shared.sectionTitle}>
              {block.title}
            </h2>
            {block.coverUrl ? (
              <img
                src={block.coverUrl}
                alt={block.title}
                className={styles.blockCover}
              />
            ) : null}
            {block.body ? (
              <div
                className={styles.blockBody}
                dangerouslySetInnerHTML={{ __html: block.body }}
              />
            ) : null}
            {block.linkUrl ? (
              <div className={shared.btnRow}>
                <a
                  href={block.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={shared.btnPrimary}
                >
                  {block.linkLabel || "了解更多"}
                </a>
              </div>
            ) : null}
          </section>
        ))}

        <section className={shared.section} aria-labelledby="featured-activities">
          <div className={shared.sectionHead}>
            <h2 id="featured-activities" className={shared.sectionTitle}>
              精选活动
            </h2>
            <Link to="/activities" className={shared.btnGhost}>
              查看全部
            </Link>
          </div>
          {activities.length === 0 ? (
            <div className={shared.empty}>
              暂无进行中的精选活动。
              <div className={shared.btnRow} style={{ justifyContent: "center" }}>
                <Link to="/activities" className={shared.btnSecondary}>
                  浏览全部活动
                </Link>
              </div>
            </div>
          ) : (
            <div className={shared.cardGrid}>
              {activities.map((item) => {
                const life = getActivityLifecycle(item.startAt, item.endAt);
                return (
                  <Link
                    key={item.id}
                    to={`/activities/${item.id}`}
                    className={shared.card}
                  >
                    <div className={shared.cardMedia} />
                    <div className={shared.cardBody}>
                      <h3 className={shared.cardTitle}>{item.title}</h3>
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
                      <p className={shared.cardDesc}>
                        {formatDateRange(item.startAt, item.endAt)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className={shared.section} aria-labelledby="featured-courses">
          <div className={shared.sectionHead}>
            <h2 id="featured-courses" className={shared.sectionTitle}>
              精选课程
            </h2>
            <Link to="/courses" className={shared.btnGhost}>
              查看全部
            </Link>
          </div>
          {courses.length === 0 ? (
            <div className={shared.empty}>
              暂无精选课程。
              <div className={shared.btnRow} style={{ justifyContent: "center" }}>
                <Link to="/courses" className={shared.btnSecondary}>
                  浏览全部课程
                </Link>
              </div>
            </div>
          ) : (
            <div className={shared.cardGrid}>
              {courses.map((item) => (
                <Link key={item.id} to={`/courses/${item.id}`} className={shared.card}>
                  <div className={shared.cardMedia} />
                  <div className={shared.cardBody}>
                    <h3 className={shared.cardTitle}>{item.title}</h3>
                    <p className={shared.cardDesc}>{item.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
