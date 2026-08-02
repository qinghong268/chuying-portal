import type { UserRole } from "@chuying/shared";

/** Safe relative portal paths for eagle redirect after login. */
export function isSafePortalRedirect(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/login")) return false;
  return true;
}

export function resolvePostLoginPath(
  role: UserRole,
  redirect: string | null,
): string {
  if (role === "admin" || role === "super_admin") {
    if (redirect && redirect.startsWith("/admin") && !redirect.startsWith("//")) {
      return redirect;
    }
    return "/admin";
  }

  if (redirect && isSafePortalRedirect(redirect)) {
    return redirect;
  }
  return "/me";
}
