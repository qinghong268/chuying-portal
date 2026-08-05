import { Link } from "react-router-dom";
import shared from "./shared.module.css";
import styles from "./AboutCompanyPage.module.css";

const STATS = [
  { num: "200+", label: "覆盖城市" },
  { num: "1200+", label: "数字化案例" },
  { num: "130+", label: "国家专利" },
  { num: "700+", label: "软件著作" },
];

const TECH_ENGINES = [
  {
    title: "大数据",
    desc: "加速数字政府及数据要素市场建设，助力客户实现数据价值转化与数字化升级。以数据驱动决策，释放数据要素潜能，打造智慧城市数字底座。",
  },
  {
    title: "人工智能",
    desc: "激发AI场景创新，依托鸿蒙与智能体技术，沉淀40+专业智能体应用场景，推动“行业+AI”深度融合，赋能千行百业智能化转型。",
  },
  {
    title: "数字孪生",
    desc: "专注于数字孪生引擎、城市仿真云等前沿技术，为城市治理提供可视化、可模拟、可推演的数字底座，实现城市全景感知与智能决策。",
  },
  {
    title: "鸿蒙&信创",
    desc: "推进信创国产化与城市鸿蒙化，实现数字基础设施高效集约建设、长效运营、安全可控，构建自主可控的数字基础设施新生态。",
  },
];

const CORE_BIZ = [
  {
    title: "AI DATA",
    desc: "助力客户实现数据价值转化与数字化升级，以数据智能驱动业务增长，构建数据要素市场。",
  },
  {
    title: "AI行业应用",
    desc: "依托鸿蒙与智能体技术，沉淀40+专业智能体应用场景，赋能千行百业智能化转型。",
  },
  {
    title: "AI基础设施",
    desc: "实现数字基础设施高效集约建设、长效运营、安全可控，筑牢数字经济底座。",
  },
];

const HONORS = [
  "国家高新技术企业",
  "国家级专精特新小巨人",
  "中国软件与信息服务业十大领军企业",
  "亚太智慧城市领军解决方案提供商",
  "中国大数据企业50强",
  "数字政府百强企业",
];

/** 关于软通智慧公司详情页（软通智慧专区）。 */
export function AboutCompanyPage() {
  return (
    <div className={`${shared.page} ${shared.container}`}>
      <header className={styles.banner}>
        <Link to="/" className={styles.backLink}>
          ← 返回首页
        </Link>
        <h1>关于软通智慧</h1>
        <p>中国领先的AI应用产品与服务提供商 — 以AI构建行业未来</p>
      </header>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>公司概况</h2>
        <p className={styles.prose}>
          <strong>软通智慧科技有限公司</strong>（简称"软通智慧"）是中国领先的AI应用产品与服务提供商。以
          <span className={styles.highlight}>大数据、人工智能、数字孪生、信创&鸿蒙</span>
          为核心技术引擎，聚焦AI DATA、AI行业应用、AI基础设施三大核心业务，凭借"AI+数据+算力"服务能力，为客户提供领先的智能化决策支撑解决方案。
        </p>
        <p className={styles.prose}>
          公司以北京、深圳、武汉三大基地城市为核心，在全国范围内建立30+业务中心，构建了完善的本地化运营和服务网络，产品覆盖200+城市，全国落地1200+数字化转型创新案例。
        </p>
        <div className={styles.statsGrid}>
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <div className={styles.statNumber}>{stat.num}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>核心技术引擎</h2>
        <div className={styles.bizModules}>
          {TECH_ENGINES.map((module) => (
            <div key={module.title} className={styles.bizModule}>
              <h3>{module.title}</h3>
              <p>{module.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>三大核心业务</h2>
        <div className={styles.coreBiz}>
          {CORE_BIZ.map((module) => (
            <div key={module.title} className={`${styles.bizModule} ${styles.coreModule}`}>
              <h3>{module.title}</h3>
              <p>{module.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>资质荣誉</h2>
        <p className={styles.prose}>
          软通智慧坚持以技术创新引领行业创新，是国家高新技术企业、国家级专精特新"小巨人"企业，拥有1家省级企业技术中心，先后承担国家工信部、科技部重大科研课题10余项，参编智慧城市、数字孪生等国家标准、团体标准50余项。
        </p>
        <ul className={styles.tagList}>
          {HONORS.map((honor) => (
            <li key={honor}>{honor}</li>
          ))}
        </ul>
      </section>

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>生态合作</h2>
        <p className={styles.prose}>
          软通智慧聚合30余家政、产、学、研、用等优质生态合作伙伴和优势资源，打破传统生态边界，搭建生态合作的新价值体系，构筑城市数字经济新生态。与华为等头部企业深度合作，联合发布多项创新解决方案，持续为客户创造价值。
        </p>
      </section>

      <div className={shared.btnRow}>
        <Link to="/" className={shared.btnSecondary}>
          返回首页
        </Link>
      </div>
    </div>
  );
}
