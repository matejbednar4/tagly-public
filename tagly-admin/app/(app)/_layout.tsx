import { Stack } from "expo-router";
import { AdminProvider } from "@/contexts/AdminContext";

/**
 * Authed admin shell. Mounts `AdminProvider` (`GET /v2/admin/me`) around the
 * app Stack — the tab group `(tabs)` plus pushed detail screens. Admin has no
 * drawer; Log out lives in each tab's TopMenu (`useLogoutAction`).
 */
export default function AppLayout() {
  return (
    <AdminProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AdminProvider>
  );
}
