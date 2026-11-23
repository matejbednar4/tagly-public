import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../theme/ThemeProvider";

/**
 * StepProgressOverline — the quiet "SETUP · 2 OF 4" micro line at the top of
 * each numbered onboarding/setup step. A step counter helps completion when the
 * flow is short and progress reads fast (goal gradient; see the payment-step
 * design doc), so every *task* step renders one — identity screens and
 * transition beats (finishing, success morphs) are never counted.
 *
 * Callers get `step`/`total` from their onboarding context's `stepProgress()`,
 * which excludes steps already resolved before the session started, and hide
 * the line entirely when it returns null (single-step sessions) — the counter
 * must never jump or grow mid-flow.
 */
export function StepProgressOverline({
  step,
  total,
  label,
  style,
}: {
  /** 1-based position of the current step within this session's step list. */
  step: number;
  /** Total steps in this session's list. */
  total: number;
  /**
   * Override the default "Setup" prefix with a flow-specific one (e.g.
   * "Business page · 1 of 3" inside the multi-step creation wizard), so the
   * counter names what the steps actually belong to.
   */
  label?: string;
  /**
   * Override styles (e.g. `{ paddingBottom: 0 }` when the overline sits in a
   * header row rather than stacked above the title).
   */
  style?: StyleProp<TextStyle>;
}) {
  const { t } = useTranslation("stepProgressOverline");
  const { theme } = useTheme();
  const { color, text } = theme;
  return (
    <Text
      style={[
        text.micro,
        {
          color: color.text.tertiary,
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: 1.2,
          paddingBottom: theme.spacing.lg,
        },
        style,
      ]}
    >
      {label
        ? t("labeled", { label, step, total })
        : t("label", { step, total })}
    </Text>
  );
}
