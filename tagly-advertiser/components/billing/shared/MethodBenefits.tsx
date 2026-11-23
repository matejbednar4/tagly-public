import { View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { useTheme, formatBudget } from "@tagly/client";
import { PAYG } from "@tagly/models/shared";
import type { FundingMethod } from "./MethodHeader";

/**
 * The canonical pitch for a funding method — one definition in the `billing`
 * namespace, rendered identically wherever the method is sold — which since
 * the 2026-09-02 restructure is only the never-funded `FundingPitch` and the
 * sheets that turn a rule on. A funded wallet never pitches; it reports.
 * The rows are bare (no surface of their own) so hosts can
 * wrap them in a card or drop them straight onto one. `{{surcharge}}` is
 * interpolated from `PAYG.SURCHARGE_CENTS` on every row (harmless where
 * unused).
 *
 * **`ROWS[method]` IS the point count** — each method lists exactly as many
 * rows as it has points (credits + PAYG: 2, monthly top-up: 3). Keys are
 * fully qualified (`"credits.point1"`, not an index-built
 * `` `${method}.point${i}` ``) so `PointKey` below is exactly the set of
 * points that exist: tsc rejects a key with no copy behind it, which makes
 * adding/dropping a point a compile-time-checked edit of this array **and**
 * both locale files. `${key}Sub` is derived, so subs can't drift from titles.
 */

type PointKey =
  | "credits.point1"
  | "credits.point2"
  | "payg.point1"
  | "payg.point2"
  | "monthlyBudget.point1"
  | "monthlyBudget.point2"
  | "monthlyBudget.point3";

const ROWS: Record<
  FundingMethod,
  readonly { key: PointKey; icon: keyof typeof Ionicons.glyphMap }[]
> = {
  // one-time-or-monthly · never expire
  credits: [
    { key: "credits.point1", icon: "repeat-outline" },
    { key: "credits.point2", icon: "infinite-outline" },
  ],
  // nothing upfront · nothing to watch
  payg: [
    { key: "payg.point1", icon: "shield-checkmark-outline" },
    { key: "payg.point2", icon: "sparkles-outline" },
  ],
  // automatic · only-the-difference · predictable spend
  monthlyBudget: [
    { key: "monthlyBudget.point1", icon: "sparkles-outline" },
    { key: "monthlyBudget.point2", icon: "pricetag-outline" },
    { key: "monthlyBudget.point3", icon: "trending-up-outline" },
  ],
};

export function MethodBenefits({
  method,
  card = false,
  heading = false,
}: {
  method: FundingMethod;
  /**
   * Wrap the rows in a white surface. **On a sheet's cream, always pass this**
   * — the pitch is a distinct object there and must look the same in every
   * sheet that shows one. Omit it inside a host that is already a white card
   * (the wallet's own cards, the funding pitch), where wrapping would stack
   * white on white.
   */
  card?: boolean;
  /**
   * Title the card with the method's own `benefitsTitle` ("Benefits of monthly
   * top-up"). Goes with `card`: a pitch standing as its own object says what it
   * is a pitch FOR — which the sheet header no longer always does, since the
   * monthly sheet's post-purchase header asks a question instead of naming the
   * method. Omit it where the pitch sits under a header that already named it.
   */
  heading?: boolean;
}) {
  const { t } = useTranslation("billing");
  const { theme } = useTheme();
  const { color, text, spacing, layout, radius, shadow } = theme;
  const surcharge = formatBudget(PAYG.SURCHARGE_CENTS);
  return (
    <View
      style={[
        { gap: spacing.md },
        card && {
          backgroundColor: color.surface,
          borderRadius: radius.structure,
          padding: layout.cardPadding,
          boxShadow: shadow.card,
        },
      ]}
    >
      {/* A quiet label rather than a heading: the sheet header above is already
          Playfair, so this only has to name the card, not compete with it. */}
      {heading ? (
        <Text style={[text.label, { color: color.text.secondary }]}>
          {t(`${method}.benefitsTitle`)}
        </Text>
      ) : null}
      {ROWS[method].map(({ key, icon }) => (
        <BenefitRow
          key={key}
          icon={icon}
          title={t(key, { surcharge })}
          sub={t(`${key}Sub`, { surcharge })}
        />
      ))}
    </View>
  );
}

/** One pitch row: a small ink icon + label title + caption sub. */
export function BenefitRow({
  icon,
  title,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.sm,
      }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={color.ink}
        style={{ marginTop: 1 }}
      />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[text.label, { color: color.text.primary }]}>{title}</Text>
        {sub ? (
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
