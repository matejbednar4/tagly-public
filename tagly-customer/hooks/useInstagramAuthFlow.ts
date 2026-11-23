import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { customAlert } from "@tagly/client";
import { useAndroidInstagramAuth } from "@/contexts/instagram/AndroidInstagramAuthContext";

WebBrowser.maybeCompleteAuthSession();

const { IG_CLIENT_ID, AUTH_REDIRECT_URI } = Constants.expoConfig?.extra as {
  IG_CLIENT_ID: string;
  AUTH_REDIRECT_URI: string;
};

const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
];

/**
 * Result of an Instagram OAuth flow attempt.
 *
 * - success: Instagram redirected back with a code
 * - cancel: user closed the browser voluntarily
 * - dismiss: browser was dismissed (state mismatch, locked, or programmatic close)
 * - error: Instagram redirected back with an error param (e.g. access_denied, invalid scope)
 */
export type AuthFlowResult =
  | { type: "success"; params: { code: string; state: string } }
  | { type: "cancel" }
  | { type: "dismiss" }
  | { type: "error"; instagramError: string | null; instagramErrorReason: string | null };

/**
 * Hook for Instagram OAuth authentication flow.
 *
 * Features:
 * - Browser warmup/cooldown to reduce white screen issues
 * - CSRF protection via random state parameter
 * - Comma-separated scopes (required by Instagram's business permissions API)
 */
export function useInstagramAuthFlow() {
  const { t } = useTranslation("instagramAuthFlow");
  const [isPrompting, setIsPrompting] = useState(false);
  const [showRetryScreen, setShowRetryScreen] = useState(false);
  const stateRef = useRef<string | null>(null);
  const { openOAuth } = useAndroidInstagramAuth();

  const generateState = () => {
    const randomBytes = Crypto.getRandomBytes(32);
    const state = Array.from(randomBytes, (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    stateRef.current = state;
    return state;
  };

  const buildAuthUrl = (state: string): string => {
    const params = new URLSearchParams({
      client_id: IG_CLIENT_ID,
      redirect_uri: AUTH_REDIRECT_URI,
      response_type: "code",
      scope: SCOPES.join(","),
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  };

  const parseRedirect = (url: string, state: string): AuthFlowResult => {
    const parsed = new URL(url);
    const code = parsed.searchParams.get("code");
    const returnedState = parsed.searchParams.get("state");
    const error = parsed.searchParams.get("error");
    const errorReason = parsed.searchParams.get("error_reason");

    if (error || !code) {
      return { type: "error", instagramError: error, instagramErrorReason: errorReason };
    }

    if (returnedState !== state) {
      customAlert(t("oopsTitle"), t("securityCheckFailedBody"));
      return { type: "dismiss" };
    }

    return {
      type: "success",
      params: { code, state: returnedState },
    };
  };

  const cleanup = async () => {
    await WebBrowser.coolDownAsync();
    stateRef.current = null;
    setIsPrompting(false);
  };

  const openBrowser = async (ephemeral: boolean): Promise<AuthFlowResult> => {
    const state = generateState();
    const url = buildAuthUrl(state);

    // On Android, openAuthSessionAsync triggers Instagram's App Links and opens
    // the Instagram app instead of the web OAuth form. Use an in-app WebView
    // modal instead, which bypasses App Links entirely.
    if (Platform.OS === "android") {
      try {
        return await openOAuth(url, AUTH_REDIRECT_URI, parseRedirect, state);
      } finally {
        stateRef.current = null;
        setIsPrompting(false);
      }
    }

    await WebBrowser.warmUpAsync();

    try {
      const result = await WebBrowser.openAuthSessionAsync(
        url,
        AUTH_REDIRECT_URI,
        { preferEphemeralSession: ephemeral },
      );

      if (result.type === "success") {
        return parseRedirect(result.url, state);
      }

      if (result.type === "cancel") return { type: "cancel" };
      return { type: "dismiss" };
    } finally {
      await cleanup();
    }
  };

  /**
   * Standard prompt - uses in-app browser with warmup.
   */
  const prompt = useCallback(async (): Promise<AuthFlowResult> => {
    if (isPrompting) return { type: "dismiss" };

    setIsPrompting(true);

    const result = await openBrowser(false);

    if (result.type === "cancel" || result.type === "error") {
      setShowRetryScreen(true);
    }

    return result;
  }, [isPrompting]);

  /**
   * Ephemeral prompt - uses private browsing mode (no shared cookies).
   * User will need to log in even if already logged into Instagram in Safari.
   */
  const promptEphemeral = useCallback(async (): Promise<AuthFlowResult> => {
    if (isPrompting) return { type: "dismiss" };

    setIsPrompting(true);

    const result = await openBrowser(true);

    if (result.type === "error") {
      setShowRetryScreen(true);
    }

    return result;
  }, [isPrompting]);

  const dismissRetryScreen = useCallback(() => {
    setShowRetryScreen(false);
  }, []);

  return {
    prompt,
    promptEphemeral,
    isPrompting,
    showRetryScreen,
    dismissRetryScreen,
  };
}
