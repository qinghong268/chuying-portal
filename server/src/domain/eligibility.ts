import {
  WATCH_PROGRESS_THRESHOLD,
  OFFLINE_APPLY_WINDOW_HOURS,
  REFLECTION_MIN_LEN,
  REFLECTION_MAX_LEN,
} from "@chuying/shared";

const HOUR_MS = 60 * 60 * 1000;

export function canApplyActivityReflection(input: {
  enrolled: boolean;
  mode: "online" | "offline";
  progressPercent: number;
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

  if (input.mode === "online") {
    if (input.progressPercent < WATCH_PROGRESS_THRESHOLD) {
      return {
        ok: false,
        reason: `watch progress must be at least ${WATCH_PROGRESS_THRESHOLD}%`,
      };
    }
    return { ok: true };
  }

  const windowEnd =
    input.activityEndAt + OFFLINE_APPLY_WINDOW_HOURS * HOUR_MS;
  if (input.now < input.activityEndAt || input.now > windowEnd) {
    return { ok: false, reason: "outside offline apply window" };
  }

  return { ok: true };
}

export function isReflectionLengthOk(text: string): boolean {
  const len = text.length;
  return len >= REFLECTION_MIN_LEN && len <= REFLECTION_MAX_LEN;
}
