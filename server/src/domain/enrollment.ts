export function canEnrollActivity(input: {
  mode: "online" | "offline";
  startAt: number;
  enrollDeadline: number;
  now: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.mode === "online") {
    if (input.now >= input.enrollDeadline) {
      return { ok: false, reason: "enrollment deadline has passed" };
    }
    return { ok: true };
  }

  if (input.now >= input.startAt) {
    return { ok: false, reason: "offline enrollment closed after activity start" };
  }

  return { ok: true };
}
