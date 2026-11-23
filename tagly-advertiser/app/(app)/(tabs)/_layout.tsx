import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { BottomNavigation, type BottomNavTab } from "@tagly/client";

/**
 * The three main advertiser tabs — Home (default) · Wallet · Account — rendered
 * with the shared `BottomNavigation` design. The tab config (route names +
 * labels + Ionicons) is the advertiser app's; the look is centralized in
 * `@tagly/client`.
 *
 *  - **Home** — the "what's happening + what needs me" hub: visibility status
 *    (Active / Paused), balance + runway, shares to rate, insights, recent shares.
 *  - **Wallet** — balance + status, add credits (Stripe PaymentSheet), spend
 *    history. The one recurring "add budget" surface.
 *  - **Account** — business pages, full insights, referrals, settings, log out.
 *
 * Detail screens (shares, business-pages, settings) live as siblings of
 * `(tabs)` under `(app)`, pushed onto the `(app)` Stack so they cover the
 * tab bar.
 */
export default function TabsLayout() {
  const { t } = useTranslation("tabs");

  // Folder routes with an `index.tsx` are named `<folder>/index` (e.g.
  // `home/index`), not `<folder>` — the names here must match exactly or
  // expo-router warns and can't resolve `initialRouteName`.
  const tabs: BottomNavTab[] = [
    {
      name: "home/index",
      label: t("home"),
      icon: "home",
      iconOutline: "home-outline",
    },
    {
      name: "wallet/index",
      label: t("wallet"),
      icon: "wallet",
      iconOutline: "wallet-outline",
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
      initialRouteName="home/index"
      tabBar={(props) => <BottomNavigation {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home/index" />
      <Tabs.Screen name="wallet/index" />
      <Tabs.Screen name="account/index" />
    </Tabs>
  );
}
