import { useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { callAuthed, customAlert } from "@tagly/client";
import { adminLogout } from "@tagly/sdk/v2/adminApp";
import { useSession } from "@/contexts/session/SessionContext";

/**
 * The `TopMenu` right-action for logging out, shared by all four tab roots (the
 * admin app has no drawer, so Log out lives in the bar). Confirm-guarded per the
 * admin destructive-action rule: it bumps `jwtVersion` server-side, then clears
 * the local session. Returns the `{ icon, onPress, accessibilityLabel }` shape
 * `TopMenu.rightAction` expects.
 */
export function useLogoutAction() {
  const router = useRouter();
  const { signOut } = useSession();

  const onLogout = useCallback(() => {
    customAlert("Log out?", "You'll need to sign in again to get back in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await callAuthed(router, (jwt) => adminLogout({ jwt }), {
              suppressAlerts: true,
            });
            await signOut();
          })();
        },
      },
    ]);
  }, [router, signOut]);

  return useMemo(
    () =>
      ({
        icon: "log-out-outline",
        onPress: onLogout,
        accessibilityLabel: "Log out",
      }) as const,
    [onLogout],
  );
}
