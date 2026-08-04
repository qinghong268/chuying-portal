import { Router } from "express";
import { z } from "zod";
import { getDb } from "../connection";
import { requireAuth, requireRole } from "../middleware/auth";
import { OFFLINE_APPLY_WINDOW_HOURS } from "@chuying/shared";
import {
  canApplyActivityReflection,
  canApplyCourseReflection,
  isReflectionLengthOk,
} from "../domain/eligibility";

interface ActivityRow {
  id: number;
  title: string;
  mode: "online" | "offline";
  end_at: number;
  point_apply_deadline: number | null;
  target_points: number;
  status: string;
}

interface CourseRow {
  id: number;
  title: string;
  status: string;
}

interface ApplicationRow {
  id: number;
  user_id: number;
  type: "type1" | "type2";
  activity_id: number | null;
  course_id: number | null;
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
    courseId: row.course_id,
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

function getCourseEnrollmentProgress(
  userId: number,
  courseId: number,
): { enrolled: boolean; progressPercent: number } {
  const enrollment = getDb()
    .prepare(
      `SELECT id FROM course_enrollments
       WHERE user_id = ? AND course_id = ?`,
    )
    .get(userId, courseId) as { id: number } | undefined;

  if (!enrollment) {
    return { enrolled: false, progressPercent: 0 };
  }

  const progress = getDb()
    .prepare(
      `SELECT percent FROM course_progress WHERE user_id = ? AND course_id = ?`,
    )
    .get(userId, courseId) as { percent: number } | undefined;

  return { enrolled: true, progressPercent: progress?.percent ?? 0 };
}

function hasBlockingType1Application(
  userId: number,
  activityId: number,
): boolean {
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

function hasBlockingType1CourseApplication(
  userId: number,
  courseId: number,
): boolean {
  const row = getDb()
    .prepare(
      `SELECT id FROM point_applications
       WHERE user_id = ? AND course_id = ? AND type = 'type1'
         AND status IN ('pending', 'approved')
       LIMIT 1`,
    )
    .get(userId, courseId) as { id: number } | undefined;
  return Boolean(row);
}

const type1Schema = z
  .object({
    type: z.literal("type1"),
    activityId: z.number().int().positive().optional(),
    courseId: z.number().int().positive().optional(),
    reflection: z.string(),
  })
  .refine(
    (value) => (value.activityId == null) !== (value.courseId == null),
    { message: "exactly one of activityId or courseId is required" },
  );

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
              a.point_apply_deadline, a.target_points, a.status AS activity_status
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
    point_apply_deadline: number | null;
    target_points: number;
    activity_status: string;
  }>;

  const enrollments = rows.map((row) => {
    const { progressPercent } = getEnrollmentProgress(userId, row.activity_id);
    const blocked = hasBlockingType1Application(userId, row.activity_id);
    const eligibility = canApplyActivityReflection({
      enrolled: true,
      activityEndAt: row.end_at,
      pointApplyDeadline: row.point_apply_deadline,
      now,
    });

    const activityPublished = row.activity_status === "published";
    let canApplyType1 = eligibility.ok && !blocked && activityPublished;
    let applyBlockedReason: string | undefined;

    if (!activityPublished) {
      canApplyType1 = false;
      applyBlockedReason = "活动未发布";
    } else if (blocked) {
      canApplyType1 = false;
      applyBlockedReason = "已有待审或已通过的心得申请";
    } else if (!eligibility.ok) {
      canApplyType1 = false;
      if (eligibility.reason === "point apply channel closed") {
        applyBlockedReason = "积分申请通道已关闭";
      } else if (now < row.end_at) {
        applyBlockedReason = "活动结束后 24 小时内可申请";
      } else {
        applyBlockedReason = "申请窗口已关闭";
      }
    }

    const hardWindowEnd =
      row.end_at + OFFLINE_APPLY_WINDOW_HOURS * 60 * 60 * 1000;
    const channelEnd = row.point_apply_deadline ?? hardWindowEnd;
    const windowEnd = Math.min(hardWindowEnd, channelEnd);
    const applyWindowRemainingMs =
      now >= row.end_at && now <= windowEnd ? windowEnd - now : null;

    return {
      id: row.enrollment_id,
      activityId: row.activity_id,
      activityTitle: row.title,
      activityMode: row.mode,
      startAt: row.start_at,
      endAt: row.end_at,
      targetPoints: row.target_points,
      activityPublished,
      enrolledAt: row.enrolled_at,
      status: row.enrollment_status,
      progressPercent: row.mode === "online" ? progressPercent : undefined,
      canApplyType1,
      applyBlockedReason,
      applyWindowRemainingMs,
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
        `SELECT a.id, a.title, a.mode, a.end_at, a.point_apply_deadline, a.target_points, a.status
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
        const check = canApplyActivityReflection({
          enrolled: true,
          activityEndAt: activity.end_at,
          pointApplyDeadline: activity.point_apply_deadline,
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
  "/point-applications/eligible-courses",
  requireAuth,
  requireRole("eagle"),
  (req, res) => {
    const userId = req.authUser!.id;

    const rows = getDb()
      .prepare(
        `SELECT c.id, c.title, c.status, cp.percent AS progress_percent
         FROM courses c
         INNER JOIN course_enrollments ce ON ce.course_id = c.id AND ce.user_id = ?
         LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.user_id = ?
         WHERE c.status = 'published'`,
      )
      .all(userId, userId) as Array<{
      id: number;
      title: string;
      status: string;
      progress_percent: number | null;
    }>;

    const eligible = rows
      .filter(
        (course) =>
          !hasBlockingType1CourseApplication(userId, course.id) &&
          canApplyCourseReflection({
            enrolled: true,
            progressPercent: course.progress_percent ?? 0,
          }).ok,
      )
      .map((course) => ({
        id: course.id,
        title: course.title,
        progressPercent: course.progress_percent ?? 0,
      }));

    res.json({ courses: eligible });
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
        res.status(400).json({ error: "Reflection must be 300-1000 characters" });
        return;
      }

      const payload = JSON.stringify({ reflection: body.reflection });

      if (body.courseId != null) {
        const course = getDb()
          .prepare(
            `SELECT id, title, status FROM courses WHERE id = ? AND status = 'published'`,
          )
          .get(body.courseId) as CourseRow | undefined;

        if (!course) {
          res.status(404).json({ error: "Course not found" });
          return;
        }

        if (hasBlockingType1CourseApplication(userId, course.id)) {
          res.status(409).json({
            error: "A pending or approved application already exists for this course",
          });
          return;
        }

        const { enrolled, progressPercent } = getCourseEnrollmentProgress(
          userId,
          course.id,
        );
        const eligibility = canApplyCourseReflection({
          enrolled,
          progressPercent,
        });

        if (!eligibility.ok) {
          res.status(422).json({ error: eligibility.reason });
          return;
        }

        const result = getDb()
          .prepare(
            `INSERT INTO point_applications
             (user_id, type, activity_id, course_id, template_code, payload, status, points_requested, created_at)
             VALUES (?, 'type1', NULL, ?, NULL, ?, 'pending', NULL, ?)`,
          )
          .run(userId, course.id, payload, now);

        const row = getDb()
          .prepare(`SELECT * FROM point_applications WHERE id = ?`)
          .get(Number(result.lastInsertRowid)) as ApplicationRow;

        res.status(201).json({ application: toPublicApplication(row) });
        return;
      }

      const activity = getDb()
        .prepare(
          `SELECT id, title, mode, end_at, point_apply_deadline, target_points, status
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

      const eligibility = canApplyActivityReflection({
        enrolled: true,
        activityEndAt: activity.end_at,
        pointApplyDeadline: activity.point_apply_deadline,
        now,
      });

      if (!eligibility.ok) {
        res.status(422).json({ error: eligibility.reason });
        return;
      }

      const result = getDb()
        .prepare(
          `INSERT INTO point_applications
           (user_id, type, activity_id, course_id, template_code, payload, status, points_requested, created_at)
           VALUES (?, 'type1', ?, NULL, NULL, ?, 'pending', ?, ?)`,
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
         (user_id, type, activity_id, course_id, template_code, payload, status, points_requested, created_at)
         VALUES (?, 'type2', NULL, NULL, ?, ?, 'pending', ?, ?)`,
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
