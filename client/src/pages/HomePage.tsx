import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFadeIn } from "../hooks/useFadeIn";
import styles from "./HomePage.module.css";

/** 上传到服务器的素材图片（admin 上传接口返回的 URL）。 */
const IMG = {
  /** 雏英计划 logo */
  logo: "/uploads/1785897770268-299854676.png",
  /** 软通智慧公司 logo */
  softtongLogo: "/uploads/1785916774170-208286232.png",
  /** Hero 背景轮播（往届雏英合照 1-3） */
  heroSlides: [
    "/uploads/1785897770675-728835422.png",
    "/uploads/1785897770732-896920385.png",
    "/uploads/1785897770787-626953244.png",
  ],
  /** 计划简介配图（往届雏英合照 4） */
  introImage: "/uploads/1785897770843-797447149.png",
  /** 2026届雏英集训照片（2 张轮播） */
  batch: [
    "/uploads/1785916853844-632232972.jpg",
    "/uploads/1785916853893-476944081.jpg",
  ],
  /** 雏英风采人物照片 */
  dong: "/uploads/1785897770500-851448669.png",
  tan: "/uploads/1785897770561-752995112.png",
  xu: "/uploads/1785897770617-862671229.png",
  bi: "/uploads/1785916774103-21570142.png",
};

/** Hero 背景轮播间隔（毫秒）。 */
const HERO_INTERVAL = 5000;
/** 2026届照片轮播间隔（毫秒）。 */
const BATCH_INTERVAL = 4000;

const SLOGANS = ["听指挥", "打硬仗", "作风正", "业务强"];

const NAV_SECTIONS = [
  { id: "intro", label: "计划简介" },
  { id: "timeline", label: "成长路径" },
  { id: "stars", label: "雏英风采" },
  { id: "new-batch", label: "2026届" },
];

const VALUES = [
  { icon: "🧠", title: "听指挥", tag: "— 脑", desc: "令行禁止\n使命必达" },
  { icon: "❤️", title: "打硬仗", tag: "— 心", desc: "斗志昂扬\n敢打敢拼" },
  { icon: "🩸", title: "作风正", tag: "— 血", desc: "品质刚正\n务实奋发" },
  { icon: "🦴", title: "业务强", tag: "— 骨", desc: "专业过硬\n业务娴熟" },
];

/** 软通智慧四大核心业务引擎卡片。 */
const BIZ = [
  {
    icon: "数",
    title: "大数据",
    desc: "加速数字政府及数据要素市场建设，释放数据价值",
    gradient: "linear-gradient(135deg, #3584e4, #1a5fb4)",
  },
  {
    icon: "智",
    title: "人工智能",
    desc: "激发AI场景创新，沉淀40+专业智能体应用场景",
    gradient: "linear-gradient(135deg, #e74c3c, #c0392b)",
  },
  {
    icon: "孪",
    title: "数字孪生",
    desc: "专注于数字孪生引擎、城市仿真云等创新技术",
    gradient: "linear-gradient(135deg, #27ae60, #1e8449)",
  },
  {
    icon: "鸿",
    title: "鸿蒙&信创",
    desc: "信创国产化与城市鸿蒙化，构建安全可控数字底座",
    gradient: "linear-gradient(135deg, #f39c12, #d68910)",
  },
];

const PHASES = [
  {
    num: "1",
    title: "孵育阶段",
    time: "第 1-6 个月",
    desc: "认同公司，熟悉公司业务与流程，完成定岗。从校园走向职场，打下坚实的第一步。",
  },
  {
    num: "2",
    title: "展翅阶段",
    time: "第 7-36 个月",
    desc: "融入部门，获得认同，熟悉业务，提升技能。补充短板，全面提升业务水平，独当一面。",
  },
  {
    num: "3",
    title: "翱翔阶段",
    time: "第 37 个月之后",
    desc: "进入公司中高层干部培养计划（英才计划），开启更广阔的职业发展蓝图。",
  },
];

interface Star {
  name: string;
  role: string;
  photo: string;
  bio: string;
}

const STARS: Star[] = [
  {
    name: "董亮亮",
    role: "第九届雏英 · 智慧交通项目经理",
    photo: IMG.dong,
    bio: "2019年毕业后加入软通智慧，从事项目交付工作。两年半时间，从初出茅庐的学生成长为合格的项目经理。他坚信天地间没有生而知之的人，选择做流水般的人——于无声处积蓄力量，终有一日汇聚江海，激起惊涛骇浪。",
  },
  {
    name: "谭刚",
    role: "优秀雏英 · 总裁助理",
    photo: IMG.tan,
    bio: "总裁助理这面放大镜，放大了言行与眼界，让他看清了自己，更看到了未来。在核心岗位上，用眼观察、用心感悟、用脑思考，不放过一丝一毫成长进步的机会。砥砺前行，方得始终——这是他始终践行的成长信条。",
  },
  {
    name: "徐超",
    role: "第九届雏英 · 产品经理",
    photo: IMG.xu,
    bio: "毕业于内蒙古大学，在软通智慧的三年中，从一个产品小白成长为能独立带领团队的产品经理。三年里对每一天的足够重视，让他在产品道路上持续深耕，证明了能力并不与经验挂钩，更不被年龄定义。食桃种其核，三年桃有花。",
  },
  {
    name: "毕英杰",
    role: "第七届雏英 · 数字政务高级项目管理专员",
    photo: IMG.bi,
    bio: "2019年，他听从指挥奔赴拉萨，在高原反应中坚守岗位。他说这是一种传承——虽因工作错过一次次熔炼大会，但那份迫切想与大家相聚的心情，恰恰诠释了雏英精神的温度。",
  },
];

/** 锚点链接平滑滚动到对应区块。 */
function scrollToSection(id: string) {
  return (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}

/** 滚动进入视口时淡入（opacity 0→1, translateY 30px→0）。 */
function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useFadeIn<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={[styles.fadeIn, visible ? styles.fadeInVisible : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function HomePage() {
  const [selectedStar, setSelectedStar] = useState<Star | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);

  // Hero 背景轮播：每 5 秒切换下一张（CSS opacity 淡入淡出）。
  useEffect(() => {
    const timer = window.setInterval(
      () => setHeroIndex((i) => (i + 1) % IMG.heroSlides.length),
      HERO_INTERVAL,
    );
    return () => window.clearInterval(timer);
  }, []);

  // 2026届照片轮播：每 4 秒自动切换，支持点击圆点手动切换。
  useEffect(() => {
    const timer = window.setInterval(
      () => setBatchIndex((i) => (i + 1) % IMG.batch.length),
      BATCH_INTERVAL,
    );
    return () => window.clearInterval(timer);
  }, []);

  // 弹窗打开时：锁定背景滚动，支持 Esc 关闭。
  useEffect(() => {
    if (selectedStar === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedStar(null);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedStar]);

  return (
    <div className={styles.home}>
      {/* ========== Hero ========== */}
      <section className={styles.hero} aria-label="首页首屏">
        <div className={styles.heroSlider} aria-hidden="true">
          {IMG.heroSlides.map((src, index) => (
            <div
              key={src}
              className={`${styles.heroSlide} ${index === heroIndex ? styles.heroSlideActive : ""}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
        <div className={styles.heroOverlay} />
        <FadeIn className={styles.heroContent}>
          <div className={styles.heroLogoRow}>
            <div className={styles.heroLogoItem}>
              <img src={IMG.logo} alt="雏英计划" />
              <span>雏英计划</span>
            </div>
            <div className={styles.heroLogoDivider} aria-hidden="true" />
            <a
              className={styles.heroLogoItem}
              href="http://www.isstech.com"
              target="_blank"
              rel="noreferrer"
              title="访问软通智慧官网"
            >
              <img src={IMG.softtongLogo} alt="软通智慧" />
              <span>软通智慧</span>
            </a>
          </div>
          <h1 className={styles.heroTitle}>雏英计划</h1>
          <p className={styles.heroSubtitle}>培养与公司共同成长的"软通智慧子弟兵"</p>
          <div className={styles.heroSlogan}>
            {SLOGANS.map((slogan) => (
              <span key={slogan}>{slogan}</span>
            ))}
          </div>
          <div className={styles.heroCtaGroup}>
            <a className={styles.btnPrimary} href="#intro" onClick={scrollToSection("intro")}>
              了解更多
            </a>
            <a className={styles.btnOutline} href="#stars" onClick={scrollToSection("stars")}>
              雏英风采
            </a>
          </div>
        </FadeIn>
        <div className={styles.heroScroll}>
          <span>向下滚动</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* ========== 页面内锚点导航 ========== */}
      <nav className={styles.sectionNav} aria-label="页面内导航">
        <div className={styles.sectionNavInner}>
          <a
            className={styles.sectionNavBrand}
            href="#intro"
            onClick={scrollToSection("intro")}
          >
            <img src={IMG.logo} alt="" />
            <span>雏英计划</span>
          </a>
          {NAV_SECTIONS.map((item) => (
            <a
              key={item.id}
              className={styles.sectionNavLink}
              href={`#${item.id}`}
              onClick={scrollToSection(item.id)}
            >
              {item.label}
            </a>
          ))}
          <Link to="/join" className={styles.sectionNavCta}>
            加入雏英
          </Link>
        </div>
      </nav>

      {/* ========== 关于软通智慧 & 雏英计划 ========== */}
      <section className={`${styles.section} ${styles.introSection}`} id="intro" aria-label="关于软通智慧与雏英计划">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>ABOUT US</span>
            <h2 className={styles.sectionTitle}>关于软通智慧 &amp; 雏英计划</h2>
            <p className={styles.sectionSubtitle}>以AI构建行业未来，以人才铸就企业根基</p>
          </FadeIn>

          <div className={styles.introGrid}>
            <FadeIn className={styles.introText}>
              <h3>软通智慧科技有限公司</h3>
              <p>
                软通智慧是中国领先的AI应用产品与服务提供商，以
                <strong className={styles.highlight}>大数据、人工智能、数字孪生、鸿蒙&amp;信创</strong>
                为核心技术引擎，聚焦AI DATA、AI行业应用、AI基础设施三大核心业务，为客户提供领先的智能化决策支撑解决方案。
              </p>
              <p>
                公司以北京、深圳、武汉三大基地城市为核心，在全国建立30+业务中心，业务覆盖200+城市，落地1200+数字化创新案例。是国家高新技术企业、国家级专精特新"小巨人"企业，拥有130+专利、700+软件著作。
              </p>
              <p>
                <strong className={styles.highlight}>雏英计划</strong>
                是软通智慧面向青年人才的战略性培养项目。通过"孵育→展翅→翱翔"三阶段，打造一支"听指挥、打硬仗、作风正、业务强"的青年后备干部队伍，培养与公司共同成长的"软通智慧子弟兵"。
              </p>
              <Link to="/about-company" className={styles.introLink}>
                了解更多软通智慧 →
              </Link>
            </FadeIn>
            <FadeIn className={styles.introImage}>
              <img src={IMG.introImage} alt="往届雏英合照" />
            </FadeIn>
          </div>

          {/* 核心业务引擎 */}
          <FadeIn className={styles.bizSection}>
            <h4 className={styles.bizTitle}>核心业务引擎</h4>
            <div className={styles.bizGrid}>
              {BIZ.map((biz) => (
                <div key={biz.title} className={styles.bizCard}>
                  <div className={styles.bizIcon} style={{ background: biz.gradient }}>
                    {biz.icon}
                  </div>
                  <h4>{biz.title}</h4>
                  <p>{biz.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>

          {/* 雏英素质模型 */}
          <FadeIn className={styles.valuesSection}>
            <h4 className={styles.valuesTitle}>雏英素质模型</h4>
            <div className={styles.valuesGrid}>
              {VALUES.map((value, index) => (
                <FadeIn key={value.title} delay={index * 80} className={styles.valueCard}>
                  <div className={styles.valueIcon}>{value.icon}</div>
                  <h4>{value.title}</h4>
                  <div className={styles.valueTag}>{value.tag}</div>
                  <p className={styles.valueDesc}>{value.desc}</p>
                </FadeIn>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ========== 成长路径 ========== */}
      <section className={`${styles.section} ${styles.timelineSection}`} id="timeline" aria-label="成长路径">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>GROWTH PATH</span>
            <h2 className={styles.sectionTitle}>成长路径</h2>
            <p className={styles.sectionSubtitle}>从校园到职场，从雏英到英才——三阶段培养体系</p>
          </FadeIn>
          <div className={styles.timeline}>
            {PHASES.map((phase, index) => (
              <FadeIn key={phase.num} className={styles.timelineItem} delay={index * 100}>
                <div className={styles.timelineDot}>{phase.num}</div>
                <div className={styles.timelineCard}>
                  <h3>{phase.title}</h3>
                  <div className={styles.phaseTime}>{phase.time}</div>
                  <p>{phase.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 雏英风采 ========== */}
      <section className={`${styles.section} ${styles.starsSection}`} id="stars" aria-label="雏英风采">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>OUTSTANDING STARS</span>
            <h2 className={styles.sectionTitle}>雏英风采</h2>
            <p className={styles.sectionSubtitle}>悬停卡片查看成长故事，点击卡片查看完整介绍</p>
          </FadeIn>
          <div className={styles.starsGrid}>
            {STARS.map((star, index) => (
              <FadeIn key={star.name} delay={index * 100}>
                <button
                  type="button"
                  className={styles.starCard}
                  onClick={() => setSelectedStar(star)}
                  aria-haspopup="dialog"
                  aria-label={`查看 ${star.name} 的详细介绍`}
                >
                  <div className={styles.starPhoto}>
                    <img src={star.photo} alt={star.name} />
                  </div>
                  <div className={styles.starInfo}>
                    <h4>{star.name}</h4>
                    <div className={styles.starRole}>{star.role}</div>
                    <p className={styles.starBio}>{star.bio}</p>
                  </div>
                </button>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 2026届 ========== */}
      <section className={`${styles.section} ${styles.batchSection}`} id="new-batch" aria-label="2026届雏英">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>CLASS OF 2026</span>
            <h2 className={styles.sectionTitle}>
              2026届雏英，<span className={styles.highlight}>欢迎入列</span>
            </h2>
            <p className={styles.sectionSubtitle}>来自五湖四海的新星，在软通智慧开启职业生涯</p>
          </FadeIn>
          <div className={styles.batchGrid}>
            <FadeIn className={styles.batchPhotos}>
              <div className={styles.batchSlider}>
                <div
                  className={styles.batchTrack}
                  style={{ transform: `translateX(-${batchIndex * 100}%)` }}
                >
                  {IMG.batch.map((src, index) => (
                    <img key={src} src={src} alt={`2026届雏英照片${index + 1}`} />
                  ))}
                </div>
              </div>
              <div className={styles.batchDots}>
                {IMG.batch.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`${styles.batchDot} ${index === batchIndex ? styles.batchDotActive : ""}`}
                    onClick={() => setBatchIndex(index)}
                    aria-label={`切换到第 ${index + 1} 张照片`}
                  />
                ))}
              </div>
            </FadeIn>
            <FadeIn className={styles.batchText}>
              <p>
                7月末的北京，暑气未消，一群青年学子拖着行囊奔赴软通智慧。他们是
                <span className={styles.highlight}>2026届雏英计划</span>
                新晋成员，来自五湖四海各大高校，怀揣代码、算法知识与满腔热忱，亦带着初入职场的忐忑与期许。
              </p>
              <p>
                省去冗长开场白，新伙伴依次自我介绍，母校、专业、兴趣在欢声笑语中交织，陌生感快速消散。随即进入为期七天的集训，从拘谨走向热络，从茫然走向清晰。
              </p>
              <p>雏英发展素质模型里的十二字期许，已刻入晨跑时的呼吸、听课时的笔记、夜话时的目光。</p>
              <div className={styles.quote}>2026届雏英，欢迎入列。前路有光，身后有家，往后尽管冲。</div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ========== 雏英详情弹窗 ========== */}
      {selectedStar ? (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedStar.name} 的详细介绍`}
          onClick={() => setSelectedStar(null)}
        >
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setSelectedStar(null)}
              aria-label="关闭"
            >
              ×
            </button>
            <img className={styles.modalPhoto} src={selectedStar.photo} alt={selectedStar.name} />
            <h3>{selectedStar.name}</h3>
            <div className={styles.modalRole}>{selectedStar.role}</div>
            <p className={styles.modalBio}>{selectedStar.bio}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
