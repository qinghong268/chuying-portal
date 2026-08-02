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
