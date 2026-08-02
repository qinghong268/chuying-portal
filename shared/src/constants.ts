export const WATCH_PROGRESS_THRESHOLD = 99;
export const OFFLINE_APPLY_WINDOW_HOURS = 24;
export const REFLECTION_MIN_LEN = 300;
export const REFLECTION_MAX_LEN = 400;

export const POINT_TEMPLATE_CODES = [
  "contest_award",
  "speech",
  "project_contrib",
  "honor",
  "other_special",
] as const;

export type PointTemplateCode = (typeof POINT_TEMPLATE_CODES)[number];
