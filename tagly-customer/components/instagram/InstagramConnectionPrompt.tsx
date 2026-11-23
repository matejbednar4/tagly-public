import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CustomButton, useTheme } from "@tagly/client";
import { useInstagramConnection } from "@/contexts/instagram/InstagramConnectionContext";

// How long the incognito retry stays offered after it appears. A one-off cancel
// shouldn't leave it lingering forever; a fresh attempt re-arms it.
const RETRY_VISIBLE_MS = 60_000; // 60s

/**
 * Instagram connect/reconnect action — the button(s) that recover the IG
 * connection. Reads the state from `InstagramConnectionContext` to label the
 * primary action (connect / fix / reconnect); after a cancelled or failed
 * attempt it also offers the private-window (incognito) retry, the reliable
 * fallback when Instagram's login stalls.
 *
 * Renders **nothing** when the connection is healthy (CONNECTED) or still
 * resolving (LOADING), so callers can drop it in unconditionally. The status
 * line itself (e.g. "Instagram disconnected") is rendered by the caller. Must be
 * mounted inside `InstagramConnectionProvider`.
 */
export default function InstagramConnectionPrompt() {
  const { t } = useTranslation("instagramConnectionPrompt");
  const { instagramState, reconnectInstagram, reconnectInstagramIncognito } =
    useInstagramConnection();
  const { theme } = useTheme();
  const { color, text, spacing } = theme;

  // Which reconnect flow is in flight — drives per-button spinners + guards
  // against double taps across both buttons.
  const [pending, setPending] = useState<"normal" | "incognito" | null>(null);

  // Whether to offer the incognito retry — kept LOCAL (set from THIS prompt's own
  // attempt outcome, not a shared context signal), so a cancel here shows the
  // retry only on the instance the user actually used, not on every mounted
  // prompt (drawer + account hub + settings). It also auto-hides RETRY_VISIBLE_MS
  // after appearing, and each fresh attempt (either button) re-arms it.
  const [offerRetry, setOfferRetry] = useState(false);
  const [retryTimedOut, setRetryTimedOut] = useState(false);
  const showRetry = offerRetry && !retryTimedOut;

  useEffect(() => {
    if (!offerRetry || retryTimedOut) return;
    const id = setTimeout(() => setRetryTimedOut(true), RETRY_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [offerRetry, retryTimedOut]);

  const run = async (mode: "normal" | "incognito") => {
    if (pending) return;
    setRetryTimedOut(false); // re-arm the retry for this fresh attempt
    setPending(mode);
    try {
      // The reconnect resolves to `true` when the OAuth flow stalled/cancelled →
      // offer the incognito retry here (and only here).
      const shouldOfferRetry = await (mode === "normal"
        ? reconnectInstagram()
        : reconnectInstagramIncognito());
      setOfferRetry(shouldOfferRetry);
    } finally {
      setPending(null);
    }
  };

  // The primary action label for the current state. CONNECTED/LOADING need no
  // action (null → render nothing).
  const action = useMemo<string | null>(() => {
    switch (instagramState) {
      case "CONNECTED":
      case "LOADING":
        return null;
      case "NOT_LINKED":
        return t("actionConnect");
      case "MISSING_PERMISSION":
        return t("actionFix");
      case "DISCONNECTED":
      case "EXPIRED_TOKEN":
        return t("actionReconnect");
    }
  }, [instagramState, t]);

  if (!action) return null;

  return (
    <View style={{ gap: spacing.md }}>
      <CustomButton
        type="primary"
        icon="logo-instagram"
        label={action}
        loading={pending === "normal"}
        onPress={() => run("normal")}
      />

      {/* After a cancelled/failed attempt, offer the private-window retry
          (auto-hides after 60s; re-armed by a fresh attempt). */}
      {showRetry ? (
        <View style={{ gap: spacing.sm }}>
          <Text
            style={[
              text.caption,
              {
                color: color.text.tertiary,
                textAlign: "center",
                alignSelf: "center",
              },
            ]}
          >
            {t("retryNote")}
          </Text>
          <CustomButton
            type="secondary"
            icon="eye-off"
            label={t("actionIncognito")}
            loading={pending === "incognito"}
            onPress={() => run("incognito")}
          />
        </View>
      ) : null}
    </View>
  );
}
