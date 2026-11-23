import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { BottomNavigation, type BottomNavTab } from "@tagly/client";

/**
 * The three main tabs — Map (default) · Discover · Account — rendered with the
 * shared `BottomNavigation` design. The tab config (route names + labels +
 * Ionicons) is the customer app's; the look is centralized in `@tagly/client`.
 *
 * Detail screens (settings, share, business) live as siblings of `(tabs)` under
 * `(app)`, pushed onto the `(app)` Stack so they cover the tab bar.
 */
export default function TabsLayout() {
  const { t } = useTranslation("tabs");

  // Folder routes with an `index.tsx` are named `<folder>/index` (e.g.
  // `map/index`), not `<folder>` — the names here must match exactly or
  // expo-router warns and can't resolve `initialRouteName`.
  const tabs: BottomNavTab[] = [
    {
      name: "map/index",
      label: t("map"),
      icon: "map",
      iconOutline: "map-outline",
    },
    {
      name: "discover/index",
      label: t("discover"),
      icon: "storefront",
      iconOutline: "storefront-outline",
    },
    {
      name: "account/index",
      label: t("account"),
      icon: "person",
      iconOutline: "person-outline",
    },
  ];

  return (
    <Tabs
      initialRouteName="map/index"
      tabBar={(props) => <BottomNavigation {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="map/index" />
      <Tabs.Screen name="discover/index" />
      <Tabs.Screen name="account/index" />
    </Tabs>
  );
}
