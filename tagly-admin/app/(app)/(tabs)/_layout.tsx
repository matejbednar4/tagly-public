import { Tabs } from "expo-router";
import { BottomNavigation, type BottomNavTab } from "@tagly/client";

/**
 * The four admin tabs — Home · Review · Entities · Manage — rendered with the
 * shared `BottomNavigation` design (same as customer + advertiser). The tab
 * config (route names + labels + Ionicons) is the admin app's; the look is
 * centralized in `@tagly/client`.
 *
 * Detail screens live as siblings of `(tabs)` under `(app)`, pushed onto the
 * `(app)` Stack so they cover the tab bar. English-only (internal tool), so
 * labels are inline, not `t()`.
 */
export default function TabsLayout() {
  const tabs: BottomNavTab[] = [
    { name: "index", label: "Home", icon: "home", iconOutline: "home-outline" },
    {
      name: "review",
      label: "Review",
      icon: "checkmark-done",
      iconOutline: "checkmark-done-outline",
    },
    {
      name: "entities",
      label: "Entities",
      icon: "search",
      iconOutline: "search-outline",
    },
    {
      name: "manage",
      label: "Manage",
      icon: "construct",
      iconOutline: "construct-outline",
    },
  ];

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <BottomNavigation {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="review" />
      <Tabs.Screen name="entities" />
      <Tabs.Screen name="manage" />
    </Tabs>
  );
}
