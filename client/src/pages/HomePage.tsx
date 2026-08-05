import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useFadeIn } from "../hooks/useFadeIn";
import styles from "./HomePage.module.css";

/** 上传到服务器的素材图片（admin 上传接口返回的 URL）。 */
const IMG = {
  logo: "/uploads/1785897770268-299854676.png",
  batch1: "/uploads/1785897770326-821309194.jpg",
  batch2: "/uploads/1785897770379-58958837.jpg",
  meeting: "/uploads/1785897770433-782412658.png",
  dong: "/uploads/1785897770500-851448669.png",
  tan: "/uploads/1785897770561-752995112.png",
  xu: "/uploads/1785897770617-862671229.png",
  gallery: [
    "/uploads/1785897770675-728835422.png",
    "/uploads/1785897770732-896920385.png",
    "/uploads/1785897770787-626953244.png",
    "/uploads/1785897770843-797447149.png",
  ],
};

const SLOGANS = ["听指挥", "打硬仗", "作风正", "业务强"];

const NAV_SECTIONS = [
  { id: "intro", label: "计划简介" },
  { id: "timeline", label: "成长路径" },
  { id: "stars", label: "雏英风采" },
  { id: "new-batch", label: "2026届" },
  { id: "gallery", label: "雏英传承" },
];

const VALUES = [
  { icon: "🧠", title: "听指挥", tag: "— 脑", desc: "令行禁止\n使命必达" },
  { icon: "❤️", title: "打硬仗", tag: "— 心", desc: "斗志昂扬\n敢打敢拼" },
  { icon: "🩸", title: "作风正", tag: "— 血", desc: "品质刚正\n务实奋发" },
  { icon: "🦴", title: "业务强", tag: "— 骨", desc: "专业过硬\n业务娴熟" },
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // 弹窗/灯箱打开时：锁定背景滚动，支持 Esc 关闭、左右键切换灯箱。
  useEffect(() => {
    if (selectedStar === null && lightboxIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedStar(null);
        setLightboxIndex(null);
      }
      if (lightboxIndex !== null && event.key === "ArrowLeft") {
        setLightboxIndex(
          (i) => (i === null ? i : (i + IMG.gallery.length - 1) % IMG.gallery.length),
        );
      }
      if (lightboxIndex !== null && event.key === "ArrowRight") {
        setLightboxIndex((i) => (i === null ? i : (i + 1) % IMG.gallery.length));
      }
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedStar, lightboxIndex]);

  return (
    <div className={styles.home}>
      {/* ========== Hero ========== */}
      <section className={styles.hero} aria-label="首页首屏">
        <div className={styles.heroBg} style={{ backgroundImage: `url(${IMG.batch1})` }} />
        <div className={styles.heroOverlay} />
        <FadeIn className={styles.heroContent}>
          <img className={styles.heroLogo} src={IMG.logo} alt="雏英计划" />
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

      {/* ========== 计划简介 ========== */}
      <section className={`${styles.section} ${styles.introSection}`} id="intro" aria-label="计划简介">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>ABOUT US</span>
            <h2 className={styles.sectionTitle}>什么是雏英计划？</h2>
          </FadeIn>
          <div className={styles.introGrid}>
            <FadeIn className={styles.introText}>
              <p>
                雏英计划是软通智慧面向青年人才的战略性培养项目，旨在将雏英塑造成一支
                <span className={styles.highlight}>"听指挥、打硬仗、作风正、业务强"</span>
                的青年后备干部队伍。
              </p>
              <p>
                以雏英发展素质模型为核心，通过系统化的阶段培养，让每一位雏英从认同公司到独当一面，最终进入公司中高层干部培养计划，实现个人与公司的共同成长。
              </p>
              <p>我们的愿景：培养出与公司共同成长的"软通智慧子弟兵"。</p>
            </FadeIn>
            <FadeIn className={styles.introImage}>
              <img src={IMG.meeting} alt="雏英会议照片" />
            </FadeIn>
          </div>

          <FadeIn className={styles.valueCards}>
            {VALUES.map((value, index) => (
              <FadeIn key={value.title} delay={index * 80}>
                <div className={styles.valueCard}>
                  <div className={styles.valueIcon}>{value.icon}</div>
                  <h4>{value.title}</h4>
                  <div className={styles.valueTag}>{value.tag}</div>
                  <p className={styles.valueDesc}>{value.desc}</p>
                </div>
              </FadeIn>
            ))}
          </FadeIn>
        </div>
      </section>

      {/* ========== 成长路径 ========== */}
      <section className={`${styles.section} ${styles.timelineSection}`} id="timeline" aria-label="成长路径">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>GROWTH PATH</span>
            <h2 className={styles.sectionTitle}>成长路径</h2>
            <p className={styles.sectionSubtitle}>三个阶段，循序渐进，从雏鹰到雄鹰</p>
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
            <p className={styles.sectionSubtitle}>他们曾是雏英，如今已独当一面</p>
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
                    <p>{star.bio}</p>
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
            <h2 className={styles.sectionTitle}>2026届雏英 · 新锐入列</h2>
          </FadeIn>
          <div className={styles.batchContent}>
            <FadeIn className={styles.batchPhotos}>
              <img src={IMG.batch1} alt="2026届雏英合影1" />
              <img src={IMG.batch2} alt="2026届雏英合影2" />
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

      {/* ========== 雏英传承 ========== */}
      <section className={`${styles.section} ${styles.gallerySection}`} id="gallery" aria-label="雏英传承">
        <div className={styles.container}>
          <FadeIn className={styles.sectionHead}>
            <span className={styles.sectionTag}>HERITAGE</span>
            <h2 className={styles.sectionTitle}>雏英传承</h2>
            <p className={styles.sectionSubtitle}>一届届雏英人在这里成长、汇聚、出发</p>
          </FadeIn>
          <FadeIn className={styles.galleryGrid}>
            {IMG.gallery.map((src, index) => (
              <button
                key={src}
                type="button"
                className={styles.galleryItem}
                onClick={() => setLightboxIndex(index)}
                aria-label={`查看往届雏英合照${index + 1} 大图`}
              >
                <img src={src} alt={`往届雏英合照${index + 1}`} />
              </button>
            ))}
          </FadeIn>
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

      {/* ========== 图片灯箱 ========== */}
      {lightboxIndex !== null ? (
        <div
          className={styles.lightboxOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex(
                (i) => (i === null ? i : (i + IMG.gallery.length - 1) % IMG.gallery.length),
              );
            }}
            aria-label="上一张"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <img
            className={styles.lightboxImg}
            src={IMG.gallery[lightboxIndex]}
            alt={`往届雏英合照${lightboxIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className={`${styles.lightboxNav} ${styles.lightboxNext}`}
            onClick={(event) => {
              event.stopPropagation();
              setLightboxIndex((i) => (i === null ? i : (i + 1) % IMG.gallery.length));
            }}
            aria-label="下一张"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.modalClose}
            onClick={() => setLightboxIndex(null)}
            aria-label="关闭"
          >
            ×
          </button>
          <span className={styles.lightboxCounter}>
            {lightboxIndex + 1} / {IMG.gallery.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
