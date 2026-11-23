import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";

/**
 * Fires `onOpened` once per push-notification tap — the only observable "open"
 * signal push offers (iOS/Android never report tray views to the sender, so
 * tap-through IS the open metric). Covers both delivery paths:
 *   - warm/background taps via `addNotificationResponseReceivedListener`
 *   - the tap that LAUNCHED the app via `getLastNotificationResponseAsync`
 *     (the listener misses it on a cold start)
 * deduped by the notification's request identifier, since the cold-start
 * response can also be replayed to the listener on some platforms.
 *
 * `data` is the push payload — `data.slug` carries the backend catalog event
 * slug on every send (see the backend's `sendPushNotification`). The callback
 * is kept in a ref so an unstable caller can't re-subscribe the OS listener
 * every render. Mount once, high in the tree (inside the analytics provider,
 * outside the auth gate so pending-user taps count too).
 */
export function usePushOpenedListener(
  onOpened: (data: Record<string, unknown>) => void,
) {
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const lastHandledId = useRef<string | null>(null);

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (id && lastHandledId.current === id) return;
      lastHandledId.current = id ?? null;
      const data = response.notification.request.content.data;
      onOpenedRef.current(
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {},
      );
    };

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handle(response);
      })
      .catch(() => {
        // best-effort — analytics must never break boot
      });
    const subscription =
      Notifications.addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  }, []);
}
