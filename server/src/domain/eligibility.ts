import {
  WATCH_PROGRESS_THRESHOLD,
  OFFLINE_APPLY_WINDOW_HOURS,
  REFLECTION_MIN_LEN,
  REFLECTION_MAX_LEN,
} from "@chuying/shared";

const HOUR_MS = 60 * 60 * 1000;

// 活动（线上与线下同规则）：活动结束后 24 小时窗口内可申请心得积分。
// 线上活动不再要求观看进度。
export function canApplyActivityReflection(input: {
  enrolled: boolean;
  activityEndAt: number;
  pointApplyDeadline?: number | null;
  now: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.enrolled) {
    return { ok: false, reason: "not enrolled in this activity" };
  }

  if (
    input.pointApplyDeadline != null &&
    input.now > input.pointApplyDeadline
  ) {
    return { ok: false, reason: "point apply channel closed" };
  }

  const windowEnd = input.activityEndAt + OFFLINE_APPLY_WINDOW_HOURS * HOUR_MS;
  if (input.now < input.activityEndAt || input.now > windowEnd) {
    return { ok: false, reason: "outside activity apply window" };
  }

  return { ok: true };
}

// 课程为随时可看的视频：完成学习（进度 ≥ 99%）后可申请心得积分。
export function canApplyCourseReflection(input: {
  enrolled: boolean;
  progressPercent: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.enrolled) {
    return { ok: false, reason: "not enrolled in this course" };
  }

  if (input.progressPercent < WATCH_PROGRESS_THRESHOLD) {
    return {
      ok: false,
      reason: `watch progress must be at least ${WATCH_PROGRESS_THRESHOLD}%`,
    };
  }

  return { ok: true };
}

export function isReflectionLengthOk(text: string): boolean {
  const len = text.length;
  return len >= REFLECTION_MIN_LEN && len <= REFLECTION_MAX_LEN;
}
