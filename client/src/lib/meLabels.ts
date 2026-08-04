import type { ApplicationStatus, ApplicationType } from "../api/types";

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "pending":
      return "待审批";
    case "approved":
      return "已通过";
    case "rejected":
      return "已驳回";
  }
}

export function applicationTypeLabel(type: ApplicationType, templateCode?: string | null): string {
  if (type === "type1") return "活动/课程完成心得";
  switch (templateCode) {
    case "contest_award":
      return "比赛获奖";
    case "speech":
      return "分享宣讲";
    case "project_contrib":
      return "项目贡献";
    case "honor":
      return "荣誉表彰";
    case "other_special":
      return "其他专项";
    default:
      return "专项申请";
  }
}

export function formatApplicationNo(id: number): string {
  return `APP-${String(id).padStart(5, "0")}`;
}

export function formatHoursRemaining(ms: number): string {
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `${hours} 小时`;
}

export function mapApiError(message: string): string {
  if (message.includes("watch progress must be at least")) {
    return "课程学习进度未达要求，请完成课程（进度 ≥ 99%）后再申请";
  }
  if (message.includes("outside activity apply window")) {
    return "不在活动申请窗口内（活动结束后 24 小时内可申请）";
  }
  if (message.includes("Reflection must be")) {
    return "心得正文需 300–1000 字";
  }
  if (message.includes("already exists for this activity")) {
    return "该活动已有待审或已通过的心得申请";
  }
  if (message.includes("already exists for this course")) {
    return "该课程已有待审或已通过的心得申请";
  }
  if (message.includes("Template not available")) {
    return "所选积分模板不可用";
  }
  if (message.includes("not enrolled in this course")) {
    return "未报名该课程";
  }
  if (message.includes("not enrolled")) {
    return "未报名该活动";
  }
  return message;
}
