import { Router } from "express";
import { z } from "zod";
import { getDb } from "../connection";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  OFFLINE_APPLY_WINDOW_HOURS,
  WATCH_PROGRESS_THRESHOLD,
} from "@chuying/shared";
import {
  canApplyActivityReflection,
  isReflectionLengthOk,
} from "../domain/eligibility";

interface ActivityRow {
  id: number;
  title: string;
  mode: "online" | "offline";
  end_at: number;
  target_points: number;
  status: string;
}

interface ApplicationRow {
  id: number;
  user_id: number;
  type: "type1" | "type2";
  activity_id: number | null;
  template_code: string | null;
  payload: string;
  status: "pending" | "approved" | "rejected";
  points_requested: number | null;
  points_granted: number | null;
  reject_reason: string | null;
  reviewer_id: number | null;
  created_at: number;
  reviewed_at: number | null;
}

interface TemplateRow {
  code: string;
  name: string;
  default_points: number;
  enabled: number;
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toPublicApplication(row: ApplicationRow) {
  return {
    id: row.id,
    type: row.type,
    activityId: row.activity_id,
    templateCode: row.template_code,
    payload: parsePayload(row.payload),
    status: row.status,
    pointsRequested: row.points_requested,
    pointsGranted: row.points_granted,
    rejectReason: row.reject_reason,
    reviewerId: row.reviewer_id,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

function getEnrollmentProgress(
  userId: number,
  activityId: number,
): { enrolled: boolean; progressPercent: number } {
  const enrollment = getDb()
    .prepare(
      `SELECT id FROM enrollments
       WHERE user_id = ? AND activity_id = ? AND status = 'enrolled'`,
    )
    .get(userId, activityId) as { id: number } | undefined;

  if (!enrollment) {
    return { enrolled: false, progressPercent: 0 };
  }

  const progress = getDb()
    .prepare(
      `SELECT percent FROM watch_progress WHERE user_id = ? AND activity_id = ?`,
    )
    .get(userId, activityId) as { percent: number } | undefined;

  return { enrolled: true, progressPercent: progress?.percent ?? 0 };
}

function hasBlockingType1Application(userId: number, activityId: number): boolean {
  const row = getDb()
    .prepare(
      `SELECT id FROM point_applications
       WHERE user_id = ? AND activity_id = ? AND type = 'type1'
         AND status IN ('pending', 'approved')
       LIMIT 1`,
    )
    .get(userId, activityId) as { id: number } | undefined;
  return Boolean(row);
}

const type1Schema = z.object({
  type: z.literal("type1"),
  activityId: z.number().int().positive(),
  reflection: z.string(),
});

const type2Schema = z.object({
  type: z.literal("type2"),
  templateCode: z.string().min(1),
  title: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
});

const createSchema = z.union([type1Schema, type2Schema]);

export const pointAppsRouter = Router();

pointAppsRouter.get("/enrollments", requireAuth, requireRole("eagle"), (req, res) => {
  const userId = req.authUser!.id;
  const now = Date.now();

  const rows = getDb()
    .prepare(
      `SELECT e.id AS enrollment_id, e.enrolled_at, e.status AS enrollment_status,
              a.id AS activity_id, a.title, a.mode, a.start_at, a.end_at,
              a.target_points, a.status AS activity_status
       FROM enrollments e
       INNER JOIN activities a ON a.id = e.activity_id
       WHERE e.user_id = ? AND e.status = 'enrolled'
       ORDER BY e.enrolled_at DESC`,
    )
    .all(userId) as Array<{
    enrollment_id: number;
    enrolled_at: number;
    enrollment_status: string;
    activity_id: number;
    title: string;
    mode: "online" | "offline";
    start_at: number;
    end_at: number;
    target_points: number;
    activity_status: string;
  }>;

  const enrollments = rows.map((row) => {
    const { progressPercent } = getEnrollmentProgress(userId, row.activity_id);
    const blocked = hasBlockingType1Application(userId, row.activity_id);
    const eligibility = canApplyActivityReflection({
      enrolled: true,
      mode: row.mode,
      progressPercent,
      activityEndAt: row.end_at,
      now,
    });

    let canApplyType1 = eligibility.ok && !blocked;
    let applyBlockedReason: string | undefined;

    if (blocked) {
      canApplyType1 = false;
      applyBlockedReason = "已有待审或已通过的心得申请";
    } else if (!eligibility.ok) {
      canApplyType1 = false;
      if (row.mode === "online") {
        applyBlockedReason = `进度需达到 ${WATCH_PROGRESS_THRESHOLD}%`;
      } else if (now < row.end_at) {
        applyBlockedReason = "活动结束后 24 小时内可申请";
      } else {
        applyBlockedReason = "申请窗口已关闭";
      }
    }

    const windowEnd =
      row.end_at + OFFLINE_APPLY_WINDOW_HOURS * 60 * 60 * 1000;
    const offlineWindowRemainingMs =
      row.mode === "offline" && now >= row.end_at && now <= windowEnd
        ? windowEnd - now
        : null;

    return {
      id: row.enrollment_id,
      activityId: row.activity_id,
      activityTitle: row.title,
      activityMode: row.mode,
      startAt: row.start_at,
      endAt: row.end_at,
      targetPoints: row.target_points,
      activityPublished: row.activity_status === "published",
      enrolledAt: row.enrolled_at,
      status: row.enrollment_status,
      progressPercent: row.mode === "online" ? progressPercent : undefined,
      canApplyType1,
      applyBlockedReason,
      offlineWindowRemainingMs,
    };
  });

  res.json({ enrollments });
});

pointAppsRouter.get(
  "/point-applications/eligible-activities",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const userId = req.authUser!.id;
    const now = Date.now();

    const activities = getDb()
      .prepare(
        `SELECT a.id, a.title, a.mode, a.end_at, a.target_points, a.status
         FROM activities a
         INNER JOIN enrollments e
           ON e.activity_id = a.id AND e.user_id = ? AND e.status = 'enrolled'
         WHERE a.status = 'published'`,
      )
      .all(userId) as ActivityRow[];

    const eligible = activities
      .filter((activity) => {
        if (hasBlockingType1Application(userId, activity.id)) {
          return false;
        }
        const { enrolled, progressPercent } = getEnrollmentProgress(
          userId,
          activity.id,
        );
        const check = canApplyActivityReflection({
          enrolled,
          mode: activity.mode,
          progressPercent,
          activityEndAt: activity.end_at,
          now,
        });
        return check.ok;
      })
      .map((activity) => ({
        id: activity.id,
        title: activity.title,
        mode: activity.mode,
        targetPoints: activity.target_points,
        endAt: activity.end_at,
      }));

    res.json({ activities: eligible });
  },
);

pointAppsRouter.get(
  "/point-applications",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const userId = req.authUser!.id;
    const rows = getDb()
      .prepare(
        `SELECT * FROM point_applications
         WHERE user_id = ?
         ORDER BY created_at DESC`,
      )
      .all(userId) as ApplicationRow[];

    res.json({ applications: rows.map(toPublicApplication) });
  },
);

pointAppsRouter.get(
  "/point-applications/:id",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ error: "Invalid application id" });
      return;
    }

    const row = getDb()
      .prepare(`SELECT * FROM point_applications WHERE id = ? AND user_id = ?`)
      .get(id, req.authUser!.id) as ApplicationRow | undefined;

    if (!row) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    res.json({ application: toPublicApplication(row) });
  },
);

pointAppsRouter.post(
  "/point-applications",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid application payload" });
      return;
    }

    const userId = req.authUser!.id;
    const now = Date.now();
    const body = parsed.data;

    if (body.type === "type1") {
      if (!isReflectionLengthOk(body.reflection)) {
        res.status(400).json({ error: "Reflection must be 300-400 characters" });
        return;
      }

      const activity = getDb()
        .prepare(
          `SELECT id, title, mode, end_at, target_points, status
           FROM activities WHERE id = ? AND status = 'published'`,
        )
        .get(body.activityId) as ActivityRow | undefined;

      if (!activity) {
        res.status(404).json({ error: "Activity not found" });
        return;
      }

      if (hasBlockingType1Application(userId, activity.id)) {
        res.status(409).json({
          error: "A pending or approved application already exists for this activity",
        });
        return;
      }

      const { enrolled, progressPercent } = getEnrollmentProgress(
        userId,
        activity.id,
      );
      const eligibility = canApplyActivityReflection({
        enrolled,
        mode: activity.mode,
        progressPercent,
        activityEndAt: activity.end_at,
        now,
      });

      if (!eligibility.ok) {
        res.status(422).json({ error: eligibility.reason });
        return;
      }

      const payload = JSON.stringify({ reflection: body.reflection });
      const result = getDb()
        .prepare(
          `INSERT INTO point_applications
           (user_id, type, activity_id, template_code, payload, status, points_requested, created_at)
           VALUES (?, 'type1', ?, NULL, ?, 'pending', ?, ?)`,
        )
        .run(userId, activity.id, payload, activity.target_points, now);

      const row = getDb()
        .prepare(`SELECT * FROM point_applications WHERE id = ?`)
        .get(Number(result.lastInsertRowid)) as ApplicationRow;

      res.status(201).json({ application: toPublicApplication(row) });
      return;
    }

    const template = getDb()
      .prepare(
        `SELECT code, name, default_points, enabled
         FROM point_type_templates WHERE code = ?`,
      )
      .get(body.templateCode) as TemplateRow | undefined;

    if (!template || !template.enabled) {
      res.status(400).json({ error: "Template not available" });
      return;
    }

    const payload = JSON.stringify({
      title: body.title,
      reason: body.reason,
    });
    const result = getDb()
      .prepare(
        `INSERT INTO point_applications
         (user_id, type, activity_id, template_code, payload, status, points_requested, created_at)
         VALUES (?, 'type2', NULL, ?, ?, 'pending', ?, ?)`,
      )
      .run(userId, template.code, payload, template.default_points, now);

    const row = getDb()
      .prepare(`SELECT * FROM point_applications WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as ApplicationRow;

    res.status(201).json({ application: toPublicApplication(row) });
  },
);

pointAppsRouter.get("/points", requireAuth, requireRole("eagle"), (req, res) => {
  const userId = req.authUser!.id;
  const balanceRow = getDb()
    .prepare(
      `SELECT balance_after FROM point_ledger
       WHERE user_id = ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(userId) as { balance_after: number } | undefined;

  const ledger = getDb()
    .prepare(
      `SELECT id, application_id, delta, balance_after, description, created_at
       FROM point_ledger
       WHERE user_id = ?
       ORDER BY id DESC`,
    )
    .all(userId) as Array<{
    id: number;
    application_id: number | null;
    delta: number;
    balance_after: number;
    description: string;
    created_at: number;
  }>;

  res.json({
    balance: balanceRow?.balance_after ?? 0,
    ledger: ledger.map((entry) => ({
      id: entry.id,
      applicationId: entry.application_id,
      delta: entry.delta,
      balanceAfter: entry.balance_after,
      description: entry.description,
      createdAt: entry.created_at,
    })),
  });
});
