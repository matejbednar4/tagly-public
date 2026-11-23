import { useState } from "react";
import { View, Text, Keyboard, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useTheme,
  CustomButton,
  CustomTextInput,
  callPublic,
} from "@tagly/client";
import { adminVerifyOtp } from "@tagly/sdk/v2/adminApp";
import { useSession } from "@/contexts/session/SessionContext";

/**
 * Admin login — step 2: the long verification code emailed to the `@flaer.app`
 * address. On success the response carries the admin bearer JWT; `signIn` stores
 * it and flips the root guard into `(app)`, unmounting this screen. The session
 * is resolved server-side by email (the code is long/high-entropy, pasted from
 * the email — not a 6-digit box).
 */
export default function AdminVerifyScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { signIn } = useSession();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = !!email && code.trim().length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    setLoading(true);
    const result = await callPublic(() =>
      adminVerifyOtp({ body: { email: email!, code: code.trim() } }),
    );
    if (!result.ok || !result.data) {
      setLoading(false);
      return; // callPublic already surfaced the error
    }
    await signIn(result.data.jwt); // flips the guard → (app); this screen unmounts
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: layout.screenPadding,
          paddingTop: spacing.sm,
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <CustomButton
          type="tertiary"
          label="Back"
          icon="chevron-back"
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start" }}
        />

        <View style={{ gap: spacing.xs }}>
          <Text style={[text.display, { color: color.ink }]}>
            Enter your code
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            We emailed a verification code to {email ?? "your address"}. Paste it
            below.
          </Text>
        </View>

        <CustomTextInput
          heading="Verification code"
          placeholder="Paste the code from your email"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <CustomButton
          type="primary"
          label="Sign in"
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
