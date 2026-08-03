export function canEnrollActivity(input: {
  startAt: number;
  now: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.now >= input.startAt) {
    return { ok: false, reason: "enrollment closed after activity start" };
  }

  return { ok: true };
}
