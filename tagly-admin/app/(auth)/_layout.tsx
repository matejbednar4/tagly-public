import { Stack } from "expo-router";

/**
 * Unauthenticated admin auth stack: `login` → `verify`. Mounted by the root
 * guard when there's no JWT.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
