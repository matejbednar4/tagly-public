import type { ReactNode } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTheme, TopMenu, Loading } from "@tagly/client";

/**
 * Shared chrome for the four Review queue screens: back TopMenu, the
 * outstanding-total caption, pull-to-refresh, loading and empty states. The
 * screen renders its cards as `children`.
 */
export function QueueScreen({
  title,
  total,
  loading,
  empty,
  emptyText,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  total: number;
  loading: boolean;
  empty: boolean;
  emptyText: string;
  refreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title={title} showBack hideMenu />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Loading />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{
            paddingHorizontal: layout.screenPadding,
            paddingTop: layout.screenPadding,
            paddingBottom: spacing["2xl"],
            gap: spacing.md,
          }}
        >
          {empty ? (
            <Text
              style={[
                text.body,
                { color: color.text.secondary, textAlign: "center", marginTop: spacing["3xl"] },
              ]}
            >
              {emptyText}
            </Text>
          ) : (
            <>
              <Text style={[text.caption, { color: color.text.secondary }]}>
                {`${total} to review`}
              </Text>
              {children}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
