import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "../auth/AuthContext";
import { api } from "../api/client";
import {
  hasNotificationContent,
  type NotificationData,
} from "../components/NotificationModal";

const DISMISSED_KEY = "notif-dismissed";

/**
 * Fetches login reminders (upcoming activities, in-progress courses, pending
 * reflections, closing apply windows) for eagles and exposes them for display.
 * The modal shows at most once per day per browser session: after it is
 * dismissed (or found empty) we stamp sessionStorage so later refreshes and
 * focus-triggered auth refreshes skip the fetch.
 */
export function useNotification(user: AuthUser | null) {
  const [notification, setNotification] = useState<NotificationData | null>(
    null,
  );

  useEffect(() => {
    if (!user || user.role !== "eagle") {
      setNotification(null);
      return;
    }

    const today = new Date().toDateString();
    if (sessionStorage.getItem(DISMISSED_KEY) === today) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await api<NotificationData>("/api/me/notifications");
        if (cancelled) return;
        if (hasNotificationContent(data)) {
          setNotification(data);
        } else {
          // Nothing to show — don't re-fetch (and re-check) every navigation.
          sessionStorage.setItem(DISMISSED_KEY, today);
        }
      } catch {
        // Notification fetch failure should not block login or page load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismissNotification = useCallback(() => {
    setNotification(null);
    sessionStorage.setItem(DISMISSED_KEY, new Date().toDateString());
  }, []);

  return { notification, dismissNotification };
}
