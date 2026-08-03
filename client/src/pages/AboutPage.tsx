import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ContentBlock } from "../api/types";
import shared from "./shared.module.css";
import styles from "./AboutPage.module.css";

const FAQ = [
  {
    q: "谁可以申请加入雏英计划？",
    a: "面向有意向参与学习与实践的青年人才。具体资格说明以运营正式发布为准。",
  },
  {
    q: "加入后可以做什么？",
    a: "浏览已发布活动与课程；符合条件时可报名活动，并按规则申请活动完成心得与积分。",
  },
  {
    q: "审核需要多久？",
    a: "提交后状态为「待审核」，由具备权限的管理员处理。通知渠道待运营补充。",
  },
];

const PATH_STEPS = [
  { title: "了解计划", desc: "阅读本页与首页宣传，确认培养方向是否契合。" },
  { title: "提交申请", desc: "在「加入我们」填写资料，等待审核。" },
  { title: "参与活动与课程", desc: "审核通过后可报名活动、学习课程并积累成长记录。" },
];

export function AboutPage() {
  const [plan, setPlan] = useState<ContentBlock | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ blocks: ContentBlock[] }>("/api/content/home");
        if (cancelled) return;
        setPlan(data.blocks.find((b) => b.key === "home_plan_promo") ?? null);
      } catch {
        /* keep placeholders */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={`${shared.page} ${shared.container}`}>
      <header>
        <h1 className={shared.pageTitle}>计划介绍</h1>
        <p className={shared.lead}>
          {plan?.body ||
            "雏英计划面向青年人才，提供学习、实践与成长机会。以下为结构占位，终稿文案待运营提供。"}
        </p>
      </header>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>计划定位</h2>
        <div className={styles.prose}>
          <p>
            雏英计划是 SoftTong 面向青年人才的培养门户，帮助参与者了解活动与课程、完成实践并按规则申请积分。
          </p>
          <p className={shared.muted}>公司主体长文以首页「软通智慧」专区为主；本页聚焦计划本身。</p>
        </div>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>培养路径</h2>
        <ol className={styles.steps}>
          {PATH_STEPS.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepIndex}>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p className={shared.muted}>{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>计划亮点</h2>
        <ul className={styles.bullets}>
          <li>
            <strong>宣传与业务并存</strong>
            <span>首页讲清计划与公司，列表页承接活动与课程。</span>
          </li>
          <li>
            <strong>规则透明</strong>
            <span>报名窗口、观看进度与心得字数等规则在活动详情可见。</span>
          </li>
          <li>
            <strong>审核加入</strong>
            <span>申请经管理员审核后获得雏英身份，避免自助冒用。</span>
          </li>
        </ul>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>常见问题</h2>
        <div className={styles.faq}>
          {FAQ.map((item, i) => (
            <details key={item.q} className={styles.faqItem} open={i === 0}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className={shared.btnRow}>
        <Link to="/join" className={shared.btnAccent}>
          加入我们
        </Link>
        <Link to="/activities" className={shared.btnSecondary}>
          查看活动
        </Link>
      </div>
    </div>
  );
}
