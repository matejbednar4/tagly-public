import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import WebView from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { AuthFlowResult } from "@/hooks/useInstagramAuthFlow";

interface AndroidInstagramAuthContextValue {
  openOAuth: (
    url: string,
    redirectUri: string,
    parseResult: (url: string, state: string) => AuthFlowResult,
    state: string,
  ) => Promise<AuthFlowResult>;
}

const AndroidInstagramAuthContext =
  createContext<AndroidInstagramAuthContextValue | null>(null);

/**
 * Android-only provider for Instagram OAuth.
 *
 * On Android, `openAuthSessionAsync` triggers Instagram's App Links and opens
 * the Instagram app instead of the web OAuth form. This provider fixes that by
 * hosting the OAuth flow in an in-app WebView modal, which bypasses App Links
 * entirely. On iOS the standard openAuthSessionAsync flow is used and this
 * provider is not needed.
 *
 * Must wrap the app root so any screen can trigger Instagram auth.
 */
export function AndroidInstagramAuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const resolveRef = useRef<((result: AuthFlowResult) => void) | null>(null);
  const redirectUriRef = useRef("");
  const stateRef = useRef("");
  const parseResultRef = useRef<
    ((url: string, state: string) => AuthFlowResult) | null
  >(null);
  const completedRef = useRef(false);

  const openOAuth = useCallback(
    (
      url: string,
      redirectUri: string,
      parseResult: (url: string, state: string) => AuthFlowResult,
      state: string,
    ): Promise<AuthFlowResult> => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        redirectUriRef.current = redirectUri;
        stateRef.current = state;
        parseResultRef.current = parseResult;
        completedRef.current = false;
        setWebViewUrl(url);
        setLoading(true);
        setVisible(true);
      });
    },
    [],
  );

  const complete = useCallback((result: AuthFlowResult) => {
    if (completedRef.current) return;
    completedRef.current = true;
    setVisible(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const handleClose = useCallback(() => complete({ type: "cancel" }), [complete]);

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest): boolean => {
      if (request.url.startsWith(redirectUriRef.current)) {
        const result = parseResultRef.current?.(
          request.url,
          stateRef.current,
        ) ?? { type: "cancel" as const };
        complete(result);
        return false;
      }
      return true;
    },
    [complete],
  );

  return (
    <AndroidInstagramAuthContext.Provider value={{ openOAuth }}>
      {children}
      <InstagramWebViewModal
        visible={visible}
        url={webViewUrl}
        loading={loading}
        onClose={handleClose}
        onShouldStartLoad={handleShouldStartLoad}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
    </AndroidInstagramAuthContext.Provider>
  );
}

export function useAndroidInstagramAuth() {
  const ctx = useContext(AndroidInstagramAuthContext);
  if (!ctx)
    throw new Error(
      "useAndroidInstagramAuth must be used within AndroidInstagramAuthProvider",
    );
  return ctx;
}

function InstagramWebViewModal({
  visible,
  url,
  loading,
  onClose,
  onShouldStartLoad,
  onLoadStart,
  onLoadEnd,
}: {
  visible: boolean;
  url: string;
  loading: boolean;
  onClose: () => void;
  onShouldStartLoad: (req: ShouldStartLoadRequest) => boolean;
  onLoadStart: () => void;
  onLoadEnd: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation("androidInstagramAuth");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.cancelText}>{t("webviewCancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t("webviewTitle")}</Text>
          <View style={styles.headerRight} />
        </View>
        {url ? (
          <WebView
            source={{ uri: url }}
            onShouldStartLoadWithRequest={onShouldStartLoad}
            onLoadStart={onLoadStart}
            onLoadEnd={onLoadEnd}
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
          />
        ) : null}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  cancelText: { fontSize: 16, color: "#007AFF" },
  title: { fontSize: 16, fontWeight: "600", color: "#000" },
  headerRight: { width: 60 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
