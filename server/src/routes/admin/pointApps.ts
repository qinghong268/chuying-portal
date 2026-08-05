import { Router } from "express";
import { z } from "zod";
import { getDb } from "../../connection";
import { requireAuth, requireRole } from "../../middleware/auth";
import { requirePermission } from "../../middleware/requirePermission";
import { generateAiReview } from "../../lib/aiReview";

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
  // joined fields (populated by the detail query; null in list rows)
  user_email?: string;
  user_display_name?: string;
  activity_title?: string | null;
  activity_mode?: string | null;
  activity_description?: string | null;
  course_title?: string | null;
  course_description?: string | null;
  // joined AI review fields (null when no review exists)
  ai_review_id?: number | null;
  ai_score?: number | null;
  ai_relevance?: number | null;
  ai_suggestion?: string | null;
  ai_recommended_action?: string | null;
  ai_suggested_points?: number | null;
  ai_draft_reject_reason?: string | null;
  ai_created_at?: number | null;
}

interface AiReviewRow {
  id: number;
  application_id: number;
  score: number;
  relevance: number;
  suggestion: string;
  recommended_action: string;
  suggested_points: number | null;
  draft_reject_reason: string | null;
  created_at: number;
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toPublicAiReview(row: AiReviewRow | undefined | null) {
  if (!row) return null;
  return {
    score: row.score,
    relevance: row.relevance,
    suggestion: row.suggestion,
    recommendedAction: row.recommended_action,
    suggestedPoints: row.suggested_points,
    draftRejectReason: row.draft_reject_reason,
    createdAt: row.created_at,
  };
}

function toPublicApplication(row: ApplicationRow) {
  const aiReview =
    row.ai_review_id != null
      ? {
          score: row.ai_score,
          relevance: row.ai_relevance,
          suggestion: row.ai_suggestion,
          recommendedAction: row.ai_recommended_action,
          suggestedPoints: row.ai_suggested_points,
          draftRejectReason: row.ai_draft_reject_reason,
          createdAt: row.ai_created_at,
        }
      : null;

  return {
    id: row.id,
    userId: row.user_id,
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
    userDisplayName: row.user_display_name ?? null,
    userEmail: row.user_email ?? null,
    activityTitle: row.activity_title ?? null,
    activityMode: row.activity_mode ?? null,
    courseTitle: row.course_title ?? null,
    aiReview,
  };
}

const APPLICATION_DETAIL_SQL = `
  SELECT pa.*,
         u.email AS user_email, u.display_name AS user_display_name,
         a.title AS activity_title, a.mode AS activity_mode, a.description AS activity_description,
         c.title AS course_title, c.description AS course_description,
         ar.id AS ai_review_id, ar.score AS ai_score, ar.relevance AS ai_relevance,
         ar.suggestion AS ai_suggestion, ar.recommended_action AS ai_recommended_action,
         ar.suggested_points AS ai_suggested_points,
         ar.draft_reject_reason AS ai_draft_reject_reason, ar.created_at AS ai_created_at
  FROM point_applications pa
  JOIN users u ON u.id = pa.user_id
  LEFT JOIN activities a ON a.id = pa.activity_id
  LEFT JOIN courses c ON c.id = pa.course_id
  LEFT JOIN ai_reviews ar ON ar.application_id = pa.id
  WHERE pa.id = ?
`;

function getApplicationById(id: number): ApplicationRow | undefined {
  return getDb().prepare(APPLICATION_DETAIL_SQL).get(id) as ApplicationRow | undefined;
}

const approveSchema = z.object({
  pointsGranted: z.number().int().min(1).max(9999).optional(),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

export const adminPointAppsRouter = Router();

adminPointAppsRouter.use(
  requireAuth,
  requireRole("admin", "super_admin"),
  requirePermission("point_review"),
);

adminPointAppsRouter.get("/", (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  let sql = `SELECT pa.*, u.display_name AS user_display_name, u.email AS user_email
    FROM point_applications pa
    JOIN users u ON u.id = pa.user_id`;
  const params: string[] = [];
  if (status) {
    sql += ` WHERE pa.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY pa.created_at DESC`;

  const rows = getDb().prepare(sql).all(...params) as ApplicationRow[];
  res.json({ applications: rows.map(toPublicApplication) });
});

adminPointAppsRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const row = getApplicationById(id);

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({ application: toPublicApplication(row) });
});

// POST /:id/ai-review — Generate AI review for a point application
adminPointAppsRouter.post("/:id/ai-review", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const row = getApplicationById(id);

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const payload = parsePayload(row.payload);
  const reflection = typeof payload.reflection === "string" ? payload.reflection : "";

  if (!reflection) {
    res.status(400).json({ error: "Application has no reflection to review" });
    return;
  }

  const activityTitle =
    row.activity_title ?? row.course_title ?? "（未关联活动/课程）";
  const activityDescription =
    row.activity_description ?? row.course_description ?? "";

  try {
    const result = await generateAiReview({
      activityTitle,
      activityDescription,
      reflection,
      targetPoints: row.points_requested ?? 0,
      applicantName: row.user_display_name ?? `用户 #${row.user_id}`,
    });

    const now = Date.now();
    getDb()
      .prepare(
        `INSERT INTO ai_reviews
         (application_id, score, relevance, suggestion, recommended_action, suggested_points, draft_reject_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(application_id) DO UPDATE SET
           score = excluded.score,
           relevance = excluded.relevance,
           suggestion = excluded.suggestion,
           recommended_action = excluded.recommended_action,
           suggested_points = excluded.suggested_points,
           draft_reject_reason = excluded.draft_reject_reason,
           created_at = excluded.created_at`,
      )
      .run(
        id,
        Math.max(1, Math.min(10, Math.round(result.score))),
        Math.max(1, Math.min(10, Math.round(result.relevance))),
        result.suggestion ?? "",
        result.recommendedAction ?? "review",
        result.suggestedPoints ?? null,
        result.draftRejectReason ?? null,
        now,
      );

    const aiRow = getDb()
      .prepare(`SELECT * FROM ai_reviews WHERE application_id = ?`)
      .get(id) as AiReviewRow;

    res.json({ aiReview: toPublicAiReview(aiRow) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    res.status(502).json({ error: `AI 审核生成失败：${message}` });
  }
});

adminPointAppsRouter.post("/:id/approve", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const parsed = approveSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pointsGranted" });
    return;
  }

  const row = getApplicationById(id);

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (row.status !== "pending") {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const pointsGranted =
    parsed.data.pointsGranted ?? row.points_requested ?? undefined;
  if (
    pointsGranted === undefined ||
    !Number.isInteger(pointsGranted) ||
    pointsGranted < 1 ||
    pointsGranted > 9999
  ) {
    res.status(400).json({ error: "pointsGranted is required" });
    return;
  }

  const reviewerId = req.authUser!.id;
  const now = Date.now();

  const run = getDb().transaction(() => {
    const updateResult = getDb()
      .prepare(
        `UPDATE point_applications
         SET status = 'approved',
             points_granted = ?,
             reviewer_id = ?,
             reviewed_at = ?,
             reject_reason = NULL
         WHERE id = ? AND status = 'pending'`,
      )
      .run(pointsGranted, reviewerId, now, id);

    if (updateResult.changes !== 1) {
      throw new Error("CONFLICT");
    }

    const updated = getApplicationById(id);

    if (!updated) throw new Error("NOT_FOUND");

    const balanceRow = getDb()
      .prepare(
        `SELECT balance_after FROM point_ledger
         WHERE user_id = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(row.user_id) as { balance_after: number } | undefined;

    const balanceAfter = (balanceRow?.balance_after ?? 0) + pointsGranted;
    const description =
      row.points_requested != null && row.points_requested !== pointsGranted
        ? `积分申请#${id}通过（申请${row.points_requested}→最终${pointsGranted}）`
        : `积分申请#${id}通过`;

    getDb()
      .prepare(
        `INSERT INTO point_ledger
         (user_id, application_id, delta, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.user_id, id, pointsGranted, balanceAfter, description, now);

    return updated;
  });

  try {
    const updated = run();
    res.json({ application: toPublicApplication(updated) });
  } catch (err) {
    if (err instanceof Error && err.message === "CONFLICT") {
      res.status(409).json({ error: "Application already reviewed" });
      return;
    }
    if (err instanceof Error && err.message === "NOT_FOUND") {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    throw err;
  }
});

adminPointAppsRouter.post("/:id/reject", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const parsed = rejectSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Reject reason required (5-500 characters)" });
    return;
  }

  const row = getApplicationById(id);

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (row.status !== "pending") {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const now = Date.now();
  const updateResult = getDb()
    .prepare(
      `UPDATE point_applications
       SET status = 'rejected',
           reject_reason = ?,
           reviewer_id = ?,
           reviewed_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(parsed.data.reason, req.authUser!.id, now, id);

  if (updateResult.changes !== 1) {
    res.status(409).json({ error: "Application already reviewed" });
    return;
  }

  const updated = getApplicationById(id);

  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({ application: toPublicApplication(updated) });
});
