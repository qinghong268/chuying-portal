export function tsToDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToTs(value: string): number {
  return new Date(value).getTime();
}

export function roleLabel(role: string): string {
  switch (role) {
    case "eagle":
      return "雏鹰";
    case "admin":
      return "管理员";
    case "super_admin":
      return "超级管理员";
    default:
      return role;
  }
}

export function joinStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "待审核";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
    default:
      return status;
  }
}

export function activityStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

export function activityModeLabel(mode: string): string {
  return mode === "online" ? "线上" : "线下";
}

export function contentStatusLabel(status: string): string {
  return status === "published" ? "已发布" : "草稿";
}
