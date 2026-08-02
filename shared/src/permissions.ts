export const PERMISSION_PACKAGES = [
  "content",
  "join_review",
  "activity",
  "point_type",
  "point_review",
  "user",
  "dashboard",
  "permission",
] as const;

export type PermissionCode = (typeof PERMISSION_PACKAGES)[number];
