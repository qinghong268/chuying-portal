export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateRange(startAt: number, endAt: number): string {
  return `${formatDateTime(startAt)} ~ ${formatDateTime(endAt)}`;
}

export type ActivityLifecycle = "enrolling" | "ongoing" | "ended";

export function getActivityLifecycle(
  startAt: number,
  endAt: number,
  now = Date.now(),
): ActivityLifecycle {
  if (now < startAt) return "enrolling";
  if (now <= endAt) return "ongoing";
  return "ended";
}

export function lifecycleLabel(status: ActivityLifecycle): string {
  switch (status) {
    case "enrolling":
      return "报名中";
    case "ongoing":
      return "进行中";
    case "ended":
      return "已结束";
  }
}
