import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { CourseSummary } from "../api/types";
import shared from "./shared.module.css";
import styles from "./CourseDetailPage.module.css";

export function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState<CourseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const courseId = Number(id);
      if (!Number.isInteger(courseId) || courseId < 1) {
        setError("无效的课程编号");
        return;
      }
      try {
        const data = await api<{ course: CourseSummary }>(`/api/courses/${courseId}`);
        if (!cancelled) {
          setCourse(data.course);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setCourse(null);
          setError(
            err instanceof ApiError && err.status === 404
              ? "课程不存在或未发布"
              : "加载失败",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error && !course) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.error}>{error}</p>
        <Link to="/courses" className={shared.btnSecondary}>
          返回课程列表
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className={`${shared.page} ${shared.container}`}>
        <p className={shared.muted}>加载中…</p>
      </div>
    );
  }

  return (
    <div className={`${shared.page} ${shared.container}`}>
      <p className={shared.breadcrumb}>
        <Link to="/courses">课程</Link> / {course.title}
      </p>
      <div className={styles.cover} aria-hidden="true" />
      <div className={shared.cardMeta}>
        {course.featured ? <span className={shared.tag}>精选</span> : null}
      </div>
      <h1 className={shared.pageTitle}>{course.title}</h1>
      <section className={styles.prose}>
        <h2>课程说明</h2>
        <p>{course.description}</p>
        <p className={shared.muted}>
          课件、大纲与媒体资源占位，待运营补充。V1 课程为公开浏览内容。
        </p>
      </section>
      <div className={shared.btnRow}>
        <Link to="/courses" className={shared.btnSecondary}>
          返回列表
        </Link>
        <Link to="/join" className={shared.btnAccent}>
          加入我们
        </Link>
      </div>
    </div>
  );
}
