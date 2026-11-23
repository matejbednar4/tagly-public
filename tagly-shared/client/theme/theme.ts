/**
 * Design tokens — the single source of truth for color, type, spacing, radius,
 * and shadows (the `themes` object + `spacing`/`layout` below).
 *
 * KEEP IN SYNC: the design-system guide `tagly-shared/client/CLAUDE.md` documents these
 * rules and quotes some concrete values (hex codes, radii, the spacing scale) for
 * reference. Those quoted values can drift — when you change a token here, update
 * that doc so it stays accurate.
 */
import { fontFamilies, makeTextStyles, TextStyles } from "./fonts";

/** Spacing scale (px). Theme-independent — one shared definition, referenced by every theme. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

/** Layout constants (px). Theme-independent — shared like `spacing`. */
export const layout = {
  /** Max content width for centering content on large (tablet) screens. */
  contentMaxWidth: 800,
  screenPadding: 16,
  cardPadding: 16,
  cardPaddingCompact: 12,
  gap: 12,
  minTapTarget: 44,
} as const;

/**
 * Theme contract. Every theme must provide exactly these slots so that
 * `themes[name]` is interchangeable everywhere. Values are intentionally
 * widened to `string`/`number` (no `as const`) — consumers read colors at
 * runtime and don't need literal types, and the shared shape is what keeps
 * the brand and neutral palettes from drifting apart.
 */
export type Theme = {
  /** Full text-style scale (display/title/body/…) resolved for this theme's fonts. */
  text: TextStyles;
  /** Spacing scale (px). */
  spacing: typeof spacing;
  /** Layout constants (px). */
  layout: typeof layout;
  color: {
    background: string;
    surface: string;
    brand: string;
    accent: string;
    ink: string;
    success: string;
    successBg: string;
    danger: string;
    dangerBg: string;
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    on: {
      brand: string;
      accent: string;
      ink: string;
      successBg: string;
      dangerBg: string;
      dangerText: string;
    };
    border: {
      subtle: string;
      strong: string;
      divider: string;
    };
  };
  radius: {
    structure: number;
    button: number;
    pill: number;
  };
  shadow: {
    card: string;
    float: string;
    chip: string;
    button: string;
    /** Warm text shadow — RN `textShadow*` props bundled into one spreadable
     *  object (box-shadow strings can't drive text). Same warm tint as the surface
     *  shadows but heavier: a glyph is thin, so it needs more drop than a card to
     *  read as lifted (e.g. the rating stars). */
    text: {
      textShadowColor: string;
      textShadowOffset: { width: number; height: number };
      textShadowRadius: number;
    };
  };
};

/**
 * Cream — the signature Tagly palette: warm cream backgrounds, honey-yellow
 * brand fill, soft-blue accent, and brown ink.
 */
const cream: Theme = {
  text: makeTextStyles({
    heading: {
      medium: fontFamilies.playfair.medium,
      semiBold: fontFamilies.playfair.semiBold,
      bold: fontFamilies.playfair.bold,
    },
    body: {
      regular: fontFamilies.stackSans.regular,
      medium: fontFamilies.stackSans.medium,
    },
  }),
  color: {
    background: "#FFFCF2",
    surface: "#FFFFFF",
    brand: "#FFF3B0",
    accent: "#C1DBE8",
    ink: "#382724",
    success: "#3F9B6E",
    successBg: "#E4F1EA",
    danger: "#D4523E",
    dangerBg: "#FBEAE6",
    text: {
      primary: "#382724",
      secondary: "#8A6F5F",
      tertiary: "#B59A7E",
    },
    on: {
      brand: "#382724",
      accent: "#2E4A55",
      ink: "#FFF3B0",
      successBg: "#2A6B4B",
      dangerBg: "#A8301F",
      dangerText: "#C03F2D",
    },
    border: {
      subtle: "rgba(56,39,36,0.10)",
      strong: "rgba(56,39,36,0.25)",
      divider: "rgba(56,39,36,0.08)",
    },
  },
  radius: {
    structure: 8,
    button: 4,
    pill: 999,
  },
  shadow: {
    card: "0 1px 2px rgba(56,39,36,0.10), 0 4px 14px rgba(56,39,36,0.07)",
    float: "0 2px 4px rgba(56,39,36,0.12), 0 12px 32px rgba(56,39,36,0.12)",
    chip: "0 1px 2px rgba(56,39,36,0.08)",
    button: "0 2px 4px rgba(56,39,36,0.16), 0 6px 16px rgba(56,39,36,0.10)",
    text: {
      textShadowColor: "rgba(56,39,36,0.4)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  },
  spacing,
  layout,
};

export const themes = {
  brand: cream,
} as const;

export type ThemeName = keyof typeof themes;
