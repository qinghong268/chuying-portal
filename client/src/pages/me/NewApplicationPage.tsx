import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as chuyingShared from "@chuying/shared";
import { api, ApiError } from "../../api/client";
import type {
  EligibleActivity,
  EligibleCourse,
  PointApplication,
  PointTemplate,
} from "../../api/types";
import { formatDateTime } from "../../lib/datetime";
import { mapApiError } from "../../lib/meLabels";
import shared from "../shared.module.css";
import styles from "./me.module.css";

const REFLECTION_MIN = chuyingShared.REFLECTION_MIN_LEN ?? 300;
const REFLECTION_MAX = chuyingShared.REFLECTION_MAX_LEN ?? 400;

type FormType = "type1" | "type2";

export function NewApplicationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preActivityId = params.get("activityId");
  const preCourseId = params.get("courseId");
  const preType = params.get("type");
  const fromRejectedId = params.get("from");

  const [formType, setFormType] = useState<FormType>(
    preType === "template" || preType === "type2" ? "type2" : "type1",
  );
  const [eligible, setEligible] = useState<EligibleActivity[]>([]);
  const [eligibleCourses, setEligibleCourses] = useState<EligibleCourse[]>([]);
  const [templates, setTemplates] = useState<PointTemplate[]>([]);
  const [activityId, setActivityId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [reflection, setReflection] = useState("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eligibleRes, coursesRes, templatesRes] = await Promise.all([
        api<{ activities: EligibleActivity[] }>(
          "/api/me/point-applications/eligible-activities",
        ),
        api<{ courses: EligibleCourse[] }>(
          "/api/me/point-applications/eligible-courses",
        ),
        api<{ templates: PointTemplate[] }>("/api/point-type-templates?enabled=true"),
      ]);
      setEligible(eligibleRes.activities);
      setEligibleCourses(coursesRes.courses);
      setTemplates(templatesRes.templates);

      if (preActivityId) {
        const id = Number(preActivityId);
        const found = eligibleRes.activities.some((a) => a.id === id);
        if (found) {
          setFormType("type1");
          setActivityId(String(id));
        } else {
          setPrefillNote("该活动当前不可申请，请从下方列表选择或查看我的报名");
        }
      }

      if (preCourseId) {
        const id = Number(preCourseId);
        const found = coursesRes.courses.some((c) => c.id === id);
        if (found) {
          setFormType("type1");
          setCourseId(String(id));
        } else {
          setPrefillNote("该课程当前不可申请（需学习进度达到 99%），请从下方列表选择");
        }
      }

      const preTemplate = params.get("templateCode");
      if (preTemplate && templatesRes.templates.some((t) => t.code === preTemplate)) {
        setTemplateCode(preTemplate);
        setFormType("type2");
      }
    } catch {
      setError("表单数据加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [preActivityId, preCourseId, params]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (!fromRejectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api<{ application: PointApplication }>(
          `/api/me/point-applications/${fromRejectedId}`,
        );
        if (cancelled || data.application.status !== "rejected") return;
        const app = data.application;
        setPrefillNote("以下内容来自已驳回申请，提交后将创建新申请");
        if (app.type === "type1") {
          setFormType("type1");
          if (app.activityId) setActivityId(String(app.activityId));
          if (app.courseId) setCourseId(String(app.courseId));
          const ref = app.payload.reflection;
          if (typeof ref === "string") setReflection(ref);
        } else {
          setFormType("type2");
          if (app.templateCode) setTemplateCode(app.templateCode);
          const t = app.payload.title;
          const r = app.payload.reason;
          if (typeof t === "string") setTitle(t);
          if (typeof r === "string") setReason(r);
        }
      } catch {
        /* ignore prefill failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromRejectedId]);

  const selectedActivity = useMemo(
    () => eligible.find((a) => a.id === Number(activityId)),
    [eligible, activityId],
  );

  const selectedCourse = useMemo(
    () => eligibleCourses.find((c) => c.id === Number(courseId)),
    [eligibleCourses, courseId],
  );

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.code === templateCode),
    [templates, templateCode],
  );

  const reflectionLen = reflection.length;
  const reflectionValid =
    reflectionLen >= REFLECTION_MIN && reflectionLen <= REFLECTION_MAX;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (formType === "type1") {
        const hasActivity = Boolean(activityId);
        const hasCourse = Boolean(courseId);
        if (hasActivity === hasCourse) {
          setError("请从活动与课程中选择一项（二选一）");
          return;
        }
        if (!reflectionValid) {
          setError(`心得正文需 ${REFLECTION_MIN}–${REFLECTION_MAX} 字`);
          return;
        }
        const body: Record<string, unknown> = {
          type: "type1",
          reflection,
        };
        if (hasActivity) body.activityId = Number(activityId);
        if (hasCourse) body.courseId = Number(courseId);
        const data = await api<{ application: PointApplication }>(
          "/api/me/point-applications",
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
        navigate(`/me/applications/${data.application.id}`, {
          replace: true,
          state: { toast: "提交成功" },
        });
      } else {
        if (!templateCode) {
          setError("请选择积分模板");
          return;
        }
        if (!title.trim() || !reason.trim()) {
          setError("请填写具体事项与申请理由");
          return;
        }
        const data = await api<{ application: PointApplication }>(
          "/api/me/point-applications",
          {
            method: "POST",
            body: JSON.stringify({
              type: "type2",
              templateCode,
              title: title.trim(),
              reason: reason.trim(),
            }),
          },
        );
        navigate(`/me/applications/${data.application.id}`, {
          replace: true,
          state: { toast: "提交成功" },
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? mapApiError(err.message) : "提交失败，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={shared.narrow}>
      <p className={shared.breadcrumb}>
        <Link to="/me">个人中心</Link> / <Link to="/me/applications">我的申请</Link> / 发起申请
      </p>

      <h2 className={shared.pageTitle}>发起积分申请</h2>

      {prefillNote ? <p className={shared.muted}>{prefillNote}</p> : null}

      <div className={styles.typePicker}>
        <button
          type="button"
          className={`${styles.typeCard} ${formType === "type1" ? styles.typeCardActive : ""}`}
          onClick={() => setFormType("type1")}
        >
          <strong>类型一：活动 / 课程心得</strong>
          <span>绑定已报名且满足条件的活动，或学习进度 ≥ 99% 的课程</span>
        </button>
        <button
          type="button"
          className={`${styles.typeCard} ${formType === "type2" ? styles.typeCardActive : ""}`}
          onClick={() => setFormType("type2")}
        >
          <strong>类型二：独立专项申请</strong>
          <span>不绑定活动或课程，选择模板后填写事项与理由</span>
        </button>
      </div>

      {loading ? (
        <p className={shared.muted}>加载中…</p>
      ) : (
        <form className={styles.formSection} onSubmit={(e) => void handleSubmit(e)}>
          {formType === "type1" ? (
            <>
              <div className={shared.field}>
                <label htmlFor="activity-select">关联活动（可选，与课程二选一）</label>
                <select
                  id="activity-select"
                  value={activityId}
                  onChange={(e) => {
                    setActivityId(e.target.value);
                    if (e.target.value) setCourseId("");
                  }}
                >
                  <option value="">选择已可申请的活动</option>
                  {eligible.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}（{a.mode === "online" ? "线上" : "线下"}）
                    </option>
                  ))}
                </select>
                {eligible.length === 0 ? (
                  <p className={shared.muted}>
                    暂无可申请活动。
                    <Link to="/me/enrollments">查看我的报名</Link>
                    或
                    <Link to="/activities">浏览活动</Link>
                  </p>
                ) : null}
              </div>

              {selectedActivity ? (
                <div className={styles.readonly}>
                  <p>
                    形态：{selectedActivity.mode === "online" ? "线上" : "线下"} · 结束：
                    {formatDateTime(selectedActivity.endAt)}
                  </p>
                  <p>预估积分（只读）：{selectedActivity.targetPoints}</p>
                </div>
              ) : null}

              <div className={shared.field}>
                <label htmlFor="course-select">关联课程（可选，与活动二选一）</label>
                <select
                  id="course-select"
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    if (e.target.value) setActivityId("");
                  }}
                >
                  <option value="">选择学习进度 ≥ 99% 的课程</option>
                  {eligibleCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}（进度 {c.progressPercent}%）
                    </option>
                  ))}
                </select>
                {eligibleCourses.length === 0 ? (
                  <p className={shared.muted}>
                    暂无可申请课程。
                    <Link to="/courses">浏览课程</Link>
                    完成学习后（进度 ≥ 99%）即可申请。
                  </p>
                ) : null}
              </div>

              {selectedCourse ? (
                <div className={styles.readonly}>
                  <p>课程：{selectedCourse.title}</p>
                  <p>学习进度（只读）：{selectedCourse.progressPercent}%</p>
                </div>
              ) : null}

              <div className={shared.field}>
                <label htmlFor="reflection">心得正文 *</label>
                <textarea
                  id="reflection"
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={8}
                  required
                />
                <span
                  className={`${styles.charCount} ${
                    reflection && !reflectionValid ? styles.charCountInvalid : ""
                  }`}
                >
                  字数：{reflectionLen}/{REFLECTION_MAX}（需 {REFLECTION_MIN}–{REFLECTION_MAX} 字）
                </span>
              </div>
            </>
          ) : (
            <>
              <div className={shared.field}>
                <label htmlFor="template-select">积分模板 *</label>
                <select
                  id="template-select"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  required
                >
                  <option value="">选择模板</option>
                  {templates.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate ? (
                <div className={styles.readonly}>
                  <p>默认分值（只读）：{selectedTemplate.defaultPoints}</p>
                  <p className={shared.muted}>审批通过后分值可能由管理员调整</p>
                </div>
              ) : null}

              <div className={shared.field}>
                <label htmlFor="matter">具体事项 *</label>
                <input
                  id="matter"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className={shared.field}>
                <label htmlFor="reason">申请理由 *</label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={5}
                  required
                />
              </div>
            </>
          )}

          {error ? <p className={shared.error}>{error}</p> : null}

          <div className={shared.btnRow}>
            <Link to="/me/applications" className={shared.btnSecondary}>
              取消
            </Link>
            <button
              type="submit"
              className={shared.btnPrimary}
              disabled={
                busy ||
                (formType === "type1" &&
                  ((eligible.length === 0 && eligibleCourses.length === 0) ||
                    !reflectionValid)) ||
                (formType === "type2" && !templateCode)
              }
            >
              {busy ? "提交中…" : "提交申请"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
