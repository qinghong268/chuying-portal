import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import {
  datetimeLocalToTs,
  tsToDatetimeLocal,
} from "../../lib/adminLabels";
import shared from "../shared.module.css";
import styles from "./admin.module.css";

interface AdminActivity {
  id: number;
  title: string;
  description: string;
  mode: "online" | "offline";
  startAt: number;
  endAt: number;
  pointApplyDeadline: number | null;
  targetPoints: number;
  status: "draft" | "published" | "archived";
  featured: boolean;
}

const defaultForm = () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return {
    title: "",
    description: "",
    mode: "online" as "online" | "offline",
    startAt: tsToDatetimeLocal(now + day),
    endAt: tsToDatetimeLocal(now + 3 * day),
    pointApplyDeadline: tsToDatetimeLocal(now + 4 * day),
    targetPoints: 10,
    featured: false,
  };
};

export function ActivityEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new" || !id;
  const [form, setForm] = useState(defaultForm());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const res = await api<{ activity: AdminActivity }>(`/api/admin/activities/${id}`);
      const a = res.activity;
      setForm({
        title: a.title,
        description: a.description,
        mode: a.mode,
        startAt: tsToDatetimeLocal(a.startAt),
        endAt: tsToDatetimeLocal(a.endAt),
        pointApplyDeadline: a.pointApplyDeadline
          ? tsToDatetimeLocal(a.pointApplyDeadline)
          : "",
        targetPoints: a.targetPoints,
        featured: a.featured,
      });
    } catch {
      setError("活动加载失败");
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent, publish = false) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      mode: form.mode,
      startAt: datetimeLocalToTs(form.startAt),
      endAt: datetimeLocalToTs(form.endAt),
      pointApplyDeadline: form.pointApplyDeadline
        ? datetimeLocalToTs(form.pointApplyDeadline)
        : null,
      targetPoints: form.targetPoints,
      featured: form.featured,
    };
    if (publish) {
      payload.status = "published";
    } else if (isNew) {
      payload.status = "draft";
    }
    try {
      if (isNew) {
        const res = await api<{ activity: AdminActivity }>("/api/admin/activities", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        navigate(`/admin/activities/${res.activity.id}/edit`, { replace: true });
      } else {
        // PUT already handles status (including publish) in a single atomic request
        await api(`/api/admin/activities/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        void load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={shared.muted}>加载中…</p>;

  return (
    <>
      <p className={shared.breadcrumb}>
        <Link to="/admin/activities">活动管理</Link> / {isNew ? "新建" : "编辑"}
      </p>
      <h1 className={styles.pageHeadTitle}>{isNew ? "新建活动" : "编辑活动"}</h1>
      {error ? <p className={shared.error}>{error}</p> : null}

      <form className={shared.panel} onSubmit={(e) => void submit(e, false)}>
        <div className={shared.formStack}>
          <div className={shared.field}>
            <label htmlFor="act-title">标题</label>
            <input
              id="act-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="act-desc">描述</label>
            <textarea
              id="act-desc"
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="act-mode">形式</label>
            <select
              id="act-mode"
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value as "online" | "offline" })
              }
            >
              <option value="online">线上</option>
              <option value="offline">线下</option>
            </select>
          </div>
          <div className={shared.field}>
            <label htmlFor="act-start">开始时间</label>
            <input
              id="act-start"
              type="datetime-local"
              required
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="act-end">结束时间</label>
            <input
              id="act-end"
              type="datetime-local"
              required
              value={form.endAt}
              onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            />
          </div>
          <div className={shared.field}>
            <label htmlFor="act-point-deadline">积分申请通道截止</label>
            <input
              id="act-point-deadline"
              type="datetime-local"
              value={form.pointApplyDeadline}
              onChange={(e) =>
                setForm({ ...form, pointApplyDeadline: e.target.value })
              }
            />
            <p className={shared.muted}>
              发布前必填。报名截止与开始时间一致，无需单独设置。
            </p>
          </div>
          <div className={shared.field}>
            <label htmlFor="act-points">目标积分</label>
            <input
              id="act-points"
              type="number"
              min={0}
              max={9999}
              value={form.targetPoints}
              onChange={(e) =>
                setForm({ ...form, targetPoints: Number(e.target.value) })
              }
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />{" "}
            首页精选
          </label>
        </div>
        <div className={shared.btnRow}>
          <button type="submit" className={shared.btnSecondary} disabled={saving}>
            {isNew ? "存草稿" : "仅保存"}
          </button>
          <button
            type="button"
            className={shared.btnPrimary}
            disabled={saving}
            onClick={(e) => void submit(e, true)}
          >
            保存并发布
          </button>
          <Link to="/admin/activities" className={shared.btnGhost}>
            返回列表
          </Link>
        </div>
      </form>
    </>
  );
}
