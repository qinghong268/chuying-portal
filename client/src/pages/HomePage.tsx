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

const PLAN_HIGHLIGHTS = [
  { title: "实践导向", desc: "通过活动与课程串联学习与落地实践。" },
  { title: "积分成长", desc: "完成活动后可按规则申请心得与积分。" },
  { title: "开放加入", desc: "提交申请经审核后即可使用雏英身份。" },
];

function pickBlock(blocks: ContentBlock[], key: string): ContentBlock | undefined {
  return blocks.find((b) => b.key === key);
}

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

  const hero = useMemo(() => {
    const block = pickBlock(blocks, "home_hero");
    return {
      title: block?.title || DEFAULT_HERO.title,
      headline: DEFAULT_HERO.headline,
      body: block?.body || DEFAULT_HERO.body,
    };
  }, [blocks]);

  const plan = pickBlock(blocks, "home_plan_promo");
  const company = pickBlock(blocks, "home_company_promo");

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
            <a href="#company" className={styles.ctaLink}>
              了解软通 ↓
            </a>
          </div>
        </div>
      </section>

      <div className={shared.container}>
        {error ? <p className={shared.error}>{error}</p> : null}

        <section className={shared.section} aria-labelledby="plan-promo-title">
          <div className={styles.promoGrid}>
            <div className={styles.promoCopy}>
              <h2 id="plan-promo-title" className={shared.sectionTitle}>
                {plan?.title || "雏英计划宣传"}
              </h2>
              <p>
                {plan?.body ||
                  "雏英计划面向青年人才，提供学习、实践与成长机会。具体方案与细则以正式发布为准。"}
              </p>
              <ul className={styles.highlights}>
                {PLAN_HIGHLIGHTS.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <span className={shared.muted}>{item.desc}</span>
                  </li>
                ))}
              </ul>
              <div className={shared.btnRow}>
                <Link to="/about" className={shared.btnPrimary}>
                  了解更多
                </Link>
                <Link to="/join" className={shared.btnAccent}>
                  加入我们
                </Link>
              </div>
            </div>
            <div className={styles.mediaPlaceholder} aria-hidden="true">
              计划主视觉占位
              <br />
              [待运营提供]
            </div>
          </div>
        </section>

        <section
          id="company"
          className={`${shared.section} ${styles.company}`}
          aria-labelledby="company-promo-title"
        >
          <div className={styles.companyInner}>
            <div className={styles.mediaPlaceholder} aria-hidden="true">
              公司宣传素材占位
              <br />
              [待运营提供]
            </div>
            <div className={styles.promoCopy}>
              <h2 id="company-promo-title" className={shared.sectionTitle}>
                {company?.title || "软通智慧"}
              </h2>
              <p>
                {company?.body ||
                  "软通智慧致力于数字化与智能化解决方案。公司介绍与案例素材由运营团队后续补充。"}
              </p>
              <p className={shared.muted}>
                本区不展示未核实的业绩数字或荣誉；对外终稿文案与视觉待运营提供。
              </p>
            </div>
          </div>
        </section>

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
