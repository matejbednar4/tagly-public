/**
 * Static font-family names. The weight is encoded in the family name — React
 * Native cannot drive a static font's weight via `fontWeight` (iOS ignores it,
 * Android faux-bolds), so each weight ships as its own registered instance and
 * call sites pick a family, not a weight.
 */
export const fontFamilies = {
  playfair: {
    medium: "Playfair-Medium",
    semiBold: "Playfair-SemiBold",
    bold: "Playfair-Bold",
  },
  stackSans: {
    regular: "StackSans-Regular",
    medium: "StackSans-Medium",
    semiBold: "StackSans-SemiBold",
  },
} as const;

type FontKey =
  | "Playfair-Medium"
  | "Playfair-SemiBold"
  | "StackSans-Regular"
  | "StackSans-Medium"
  | "StackSans-SemiBold"
  | "Playfair-Bold";

export const customFonts: Record<FontKey, number> = {
  "Playfair-Medium": require("../assets/fonts/Playfair/static/Playfair_144pt-Medium.ttf"),
  "Playfair-SemiBold": require("../assets/fonts/Playfair/static/Playfair_144pt-SemiBold.ttf"),
  "Playfair-Bold": require("../assets/fonts/Playfair/static/Playfair_144pt-Bold.ttf"),
  "StackSans-Regular": require("../assets/fonts/Stack_Sans/static/StackSansText-Regular.ttf"),
  "StackSans-Medium": require("../assets/fonts/Stack_Sans/static/StackSansText-Medium.ttf"),
  "StackSans-SemiBold": require("../assets/fonts/Stack_Sans/static/StackSansText-SemiBold.ttf"),
};

/**
 * Per-theme font families. Each role exposes the specific static instances the
 * type scale uses; the family carries the weight (see note above).
 */
export type ThemeFont = {
  heading: { medium: string; semiBold: string; bold: string };
  body: { regular: string; medium: string };
};

/**
 * Build the type scale for a theme's fonts. Sizes/line-heights are
 * theme-independent; only the families swap per theme. Consume the active
 * theme's version via `useTheme().textStyles`; the `textStyles` exported from
 * `theme.ts` is bound to the default (brand) theme for non-React/static use.
 */
export function makeTextStyles(font: ThemeFont) {
  return {
    display: {
      fontFamily: font.heading.bold,
      fontSize: 30,
      lineHeight: lh(30, 1.1),
    },
    title: {
      fontFamily: font.heading.bold,
      fontSize: 24,
      lineHeight: lh(24, 1.15),
    },
    heading: {
      fontFamily: font.heading.bold,
      fontSize: 19,
      lineHeight: lh(19, 1.2),
    },

    body: {
      fontFamily: font.body.regular,
      fontSize: 16,
      lineHeight: lh(16, 1.5),
    },
    bodyMedium: {
      fontFamily: font.body.medium,
      fontSize: 16,
      lineHeight: lh(16, 1.5),
    },
    label: {
      fontFamily: font.body.medium,
      fontSize: 14,
      lineHeight: lh(14, 1.2),
    },
    caption: {
      fontFamily: font.body.regular,
      fontSize: 13,
      lineHeight: lh(13, 1.4),
    },
    micro: {
      fontFamily: font.body.medium,
      fontSize: 11,
      lineHeight: lh(11, 1.2),
    },

    amount: { fontFamily: font.body.medium, fontSize: 24, lineHeight: 24 },
    // Balance hero — the one big "available" figure. Sans (money never serif).
    amountLg: { fontFamily: font.body.medium, fontSize: 40, lineHeight: 44 },
    amountSm: { fontFamily: font.body.medium, fontSize: 15, lineHeight: 15 },
  } as const;
}

/**
 * RN `lineHeight` is absolute px, not a CSS multiplier — convert from a ratio.
 * (`lineHeight: 1.1` would render as ~1px and collapse the text.)
 */
const lh = (fontSize: number, ratio: number) => Math.round(fontSize * ratio);

export type TextStyles = ReturnType<typeof makeTextStyles>;
