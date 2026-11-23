import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  CustomTextInput,
  callAuthed,
  TopMenu,
} from "@tagly/client";
import { adminSearch } from "@tagly/sdk/v2/adminApp";
import type { AdminSearchResponse } from "@tagly/models/v2/adminApp";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CustomerRow,
  AdvertiserRow,
  BusinessRow,
  ShareRow,
} from "@/components/entities/EntityRows";

/**
 * Search — fuzzy lookup across every entity type (`GET /v2/admin/search`),
 * grouped into sections. Pushed over the tab bar (TopMenu back to return).
 */
export default function EntitiesSearchScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async () => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    const res = await callAuthed(
      router,
      (jwt) => adminSearch({ jwt, query: { q: trimmed } }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setResults(res.data);
    setSearching(false);
  }, [q, router]);

  const clear = useCallback(() => {
    setQ("");
    setResults(null);
    setHasSearched(false);
  }, []);

  const total = results
    ? results.customers.length +
      results.advertisers.length +
      results.locals.length +
      results.shares.length
    : 0;

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
      <Text style={[text.heading, { color: color.ink }]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Search" showBack hideMenu />

      <View
        style={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding,
          paddingBottom: spacing.md,
        }}
      >
        <CustomTextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, email, @handle, uid…"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={() => void runSearch()}
          rightIconName={q.length > 0 ? "close" : "search"}
          onRightIconPress={q.length > 0 ? clear : () => void runSearch()}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingBottom: insets.bottom + layout.screenPadding,
        }}
        keyboardDismissMode="on-drag"
      >
        {searching && !results ? (
          <View style={{ alignItems: "center", paddingTop: spacing["2xl"] }}>
            <ActivityIndicator color={color.ink} />
          </View>
        ) : !hasSearched ? (
          <Text
            style={[text.body, { color: color.text.secondary, marginTop: spacing.xl }]}
          >
            Search customers, advertisers, businesses, and shares.
          </Text>
        ) : total === 0 ? (
          <Text
            style={[text.body, { color: color.text.secondary, marginTop: spacing.xl }]}
          >
            No matches.
          </Text>
        ) : (
          <>
            {results!.customers.length > 0 && (
              <Section title="Customers">
                {results!.customers.map((c) => (
                  <CustomerRow
                    key={c.uid}
                    item={c}
                    onPress={() => router.push(`/customers/${c.uid}`)}
                  />
                ))}
              </Section>
            )}
            {results!.advertisers.length > 0 && (
              <Section title="Advertisers">
                {results!.advertisers.map((a) => (
                  <AdvertiserRow
                    key={a.uid}
                    item={a}
                    onPress={() => router.push(`/advertisers/${a.uid}`)}
                  />
                ))}
              </Section>
            )}
            {results!.locals.length > 0 && (
              <Section title="Businesses">
                {results!.locals.map((b) => (
                  <BusinessRow
                    key={b.uid}
                    item={b}
                    onPress={() => router.push(`/businesses/${b.uid}`)}
                  />
                ))}
              </Section>
            )}
            {results!.shares.length > 0 && (
              <Section title="Shares">
                {results!.shares.map((s) => (
                  <ShareRow
                    key={s.uid}
                    item={s}
                    onPress={() => router.push(`/shares/${s.uid}`)}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
