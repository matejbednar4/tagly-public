import { useState } from "react";
import { View, Text, Keyboard, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useTheme,
  CustomButton,
  CustomTextInput,
  callPublic,
} from "@tagly/client";
import { adminLogin } from "@tagly/sdk/v2/adminApp";

/**
 * Admin login — step 1: email (`@flaer.app`) + password. On submit, `adminLogin`
 * returns a **generic** response whether or not the credentials are valid
 * (anti-enumeration), so we always advance to `verify`; a code only actually
 * arrives when the credentials were correct. The `@flaer.app` rule + timing
 * defense live on the server.
 */
export default function AdminLoginScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const submit = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    setLoading(true);
    const result = await callPublic(() =>
      adminLogin({ body: { email: email.trim(), password } }),
    );
    setLoading(false);
    if (!result.ok) return; // callPublic already surfaced the error
    router.push(`/verify?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: layout.screenPadding,
          paddingTop: spacing["2xl"],
          gap: spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={[text.display, { color: color.ink }]}>
            Admin sign in
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            Tagly internal tools
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <CustomTextInput
            heading="Email"
            placeholder="you@taglyapp.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <CustomTextInput
            heading="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        </View>

        <CustomButton
          type="primary"
          label="Continue"
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          icon="arrow-forward"
          iconPosition="trailing"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
