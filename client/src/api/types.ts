import type { ActivityMode } from "@chuying/shared";

export interface ContentBlock {
  key: string;
  title: string;
  body: string;
}

export interface ActivitySummary {
  id: number;
  title: string;
  description: string;
  mode: ActivityMode;
  startAt: number;
  endAt: number;
  enrollDeadline: number;
  targetPoints: number;
  featured: boolean;
}

export interface ActivityDetail extends ActivitySummary {
  canEnroll: boolean;
  enrollBlockedReason?: string;
  enrolled?: boolean;
  progressPercent?: number;
}

export interface CourseSummary {
  id: number;
  title: string;
  description: string;
  featured: boolean;
}

export type ApplicationStatus = "pending" | "approved" | "rejected";
export type ApplicationType = "type1" | "type2";

export interface PointApplication {
  id: number;
  type: ApplicationType;
  activityId: number | null;
  templateCode: string | null;
  payload: Record<string, unknown>;
  status: ApplicationStatus;
  pointsRequested: number | null;
  pointsGranted: number | null;
  rejectReason: string | null;
  reviewerId: number | null;
  createdAt: number;
  reviewedAt: number | null;
}

export interface EligibleActivity {
  id: number;
  title: string;
  mode: "online" | "offline";
  targetPoints: number;
  endAt: number;
}

export interface PointTemplate {
  code: string;
  name: string;
  defaultPoints: number;
  enabled: boolean;
}

export interface MeEnrollment {
  id: number;
  activityId: number;
  activityTitle: string;
  activityMode: "online" | "offline";
  startAt: number;
  endAt: number;
  targetPoints: number;
  activityPublished: boolean;
  enrolledAt: number;
  status: string;
  progressPercent?: number;
  canApplyType1: boolean;
  applyBlockedReason?: string;
  offlineWindowRemainingMs?: number | null;
}

export interface PointLedgerEntry {
  id: number;
  applicationId: number | null;
  delta: number;
  balanceAfter: number;
  description: string;
  createdAt: number;
}
