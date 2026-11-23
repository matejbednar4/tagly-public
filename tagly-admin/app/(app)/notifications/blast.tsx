import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useTheme,
  TopMenu,
  CustomButton,
  CustomTextInput,
  customAlert,
  callAuthed,
  pressFeedbackStyle,
} from "@tagly/client";
import {
  adminSendBlast,
  adminGetBlastSenderDomains,
} from "@tagly/sdk/v2/adminApp";
import {
  BlastSlugSchema,
  type BlastTarget,
  type BlastChannel,
  type BlastAudience,
  type AdminGetBlastSenderDomainsResponse,
} from "@tagly/models/v2/adminApp";

/**
 * Compose and send a one-off blast (Manage tab). SUPER-only; the server
 * re-enforces everything. Sections: audience mode + targets, channels, sender
 * identity (read live from Resend's verified domains — an override sends as
 * `notifications@<domain>` and the server re-verifies before queueing), the
 * tracking slug, then per-channel content in English with an optional Czech
 * version (CS recipients fall back to EN when it's absent). The emoji row
 * prepends the chosen emoji to both push titles (house style: emoji leads,
 * "⭐ Your share was rated"). Send is confirm-guarded; EVERYONE mode gets the
 * stronger warning since it bypasses the promo opt-out (operational messages
 * only). Regardless of audience, every blast email renders as BULK mail: the
 * marketing template with a one-click unsubscribe (which opts the account out
 * of marketing only — kept even on EVERYONE sends for deliverability).
 *
 * Tracking: push opens land in PostHog as `push_opened` with slug
 * `admin.blast:<slug>`; email delivery/bounces live in the Resend
 * dashboard filtered by the `blast` tag. Recent blasts + queue stats:
 * the Blast history screen.
 */

const TARGET_OPTIONS: { value: BlastTarget; label: string }[] = [
  { value: "CUSTOMER", label: "Customers" },
  { value: "ADVERTISER", label: "Advertisers" },
  { value: "PENDING_CUSTOMER", label: "Pending customers" },
  { value: "PENDING_ADVERTISER", label: "Pending advertisers" },
];

const CHANNEL_OPTIONS: { value: BlastChannel; label: string }[] = [
  { value: "PUSH", label: "Push" },
  { value: "EMAIL", label: "Email" },
];

const AUDIENCE_OPTIONS: { value: BlastAudience; label: string }[] = [
  { value: "PROMO_OPTED_IN", label: "Promo opted-in" },
  { value: "EVERYONE", label: "Everyone" },
];

// The emoji vocabulary already used across the notification catalogs' push
// titles — keeps blasts visually consistent with the transactional pushes.
const TITLE_EMOJIS = [
  "✨",
  "🎉",
  "📣",
  "🎁",
  "⭐",
  "💸",
  "👋",
  "☕",
  "📸",
  "🎯",
  "✅",
  "📍",
  "⚠️",
] as const;

type LangContent = {
  pushTitle: string;
  pushBody: string;
  emailSubject: string;
  emailTitle: string;
  emailPreheader: string;
  emailBody: string;
  ctaLabel: string;
};

const EMPTY_CONTENT: LangContent = {
  pushTitle: "",
  pushBody: "",
  emailSubject: "",
  emailTitle: "",
  emailPreheader: "",
  emailBody: "",
  ctaLabel: "",
};

export default function BlastComposeScreen() {
  const { theme } = useTheme();
  const { color, text, spacing, layout } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [audience, setAudience] = useState<BlastAudience>("PROMO_OPTED_IN");
  const [targets, setTargets] = useState<BlastTarget[]>([]);
  const [channels, setChannels] = useState<BlastChannel[]>([]);
  const [slug, setSlug] = useState("");

  const [senderOptions, setSenderOptions] =
    useState<AdminGetBlastSenderDomainsResponse | null>(null);
  const [senderLoadFailed, setSenderLoadFailed] = useState(false);
  const [senderDomain, setSenderDomain] = useState<string | null>(null);

  const [pushEmoji, setPushEmoji] = useState<string | null>(null);
  const [csEnabled, setCsEnabled] = useState(false);
  const [en, setEn] = useState<LangContent>(EMPTY_CONTENT);
  const [cs, setCs] = useState<LangContent>(EMPTY_CONTENT);

  const [sending, setSending] = useState(false);

  // Live Resend domain list for the sender chips. A failure must not leave the
  // section silently bare (an override-less "Default" chip looks complete) —
  // the failed state renders an inline notice + retry in the sender section.
  const loadSenderDomains = async () => {
    setSenderLoadFailed(false);
    const res = await callAuthed(router, (jwt) =>
      adminGetBlastSenderDomains({ jwt }),
    );
    if (res.ok && res.data) setSenderOptions(res.data);
    else setSenderLoadFailed(true);
  };

  useEffect(() => {
    void loadSenderDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = <T,>(setter: (fn: (prev: T[]) => T[]) => void, v: T) =>
    setter((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );

  const wantsPush = channels.includes("PUSH");
  const wantsEmail = channels.includes("EMAIL");

  const slugTrimmed = slug.trim();
  const slugValid = BlastSlugSchema.safeParse(slugTrimmed).success;

  // Emoji leads both titles, matching the catalogs' style.
  const withEmoji = (title: string) =>
    pushEmoji ? `${pushEmoji} ${title.trim()}` : title.trim();

  const langValid = (c: LangContent) =>
    (!wantsPush ||
      (c.pushTitle.trim().length > 0 &&
        withEmoji(c.pushTitle).length <= 100 &&
        c.pushBody.trim().length > 0)) &&
    (!wantsEmail ||
      (c.emailSubject.trim().length > 0 && c.emailBody.trim().length > 0));

  const isValid =
    targets.length > 0 &&
    channels.length > 0 &&
    slugValid &&
    langValid(en) &&
    (!csEnabled || langValid(cs));

  // Why the Send button is disabled, spelled out — a silently dead button on
  // an irreversible-action screen burns operator time (the sneakiest case: the
  // emoji prefix pushing a full-length push title over the 100-char limit,
  // which also gets a field-level error in LangSection).
  const invalidReasons: string[] = [];
  if (targets.length === 0) invalidReasons.push("pick at least one target group");
  if (channels.length === 0) invalidReasons.push("pick at least one channel");
  if (!slugValid) invalidReasons.push("enter a valid tracking slug");
  if (channels.length > 0 && !langValid(en))
    invalidReasons.push("complete the English content");
  if (channels.length > 0 && csEnabled && !langValid(cs))
    invalidReasons.push("complete the Czech content (or switch it off)");

  const fromEmail = senderDomain
    ? `notifications@${senderDomain}`
    : (senderOptions?.defaultFromEmail ?? "the default sender");

  const buildLang = (c: LangContent) => ({
    push: wantsPush
      ? { title: withEmoji(c.pushTitle), body: c.pushBody.trim() }
      : undefined,
    email: wantsEmail
      ? {
          subject: c.emailSubject.trim(),
          body: c.emailBody.trim(),
          title: c.emailTitle.trim() || undefined,
          preheader: c.emailPreheader.trim() || undefined,
          ctaLabel: c.ctaLabel.trim() || undefined,
        }
      : undefined,
  });

  const onSend = () => {
    if (!isValid || sending) return;

    const targetLabels = TARGET_OPTIONS.filter((o) => targets.includes(o.value))
      .map((o) => o.label)
      .join(", ");
    const emailLine = wantsEmail ? ` Emails send from ${fromEmail}.` : "";
    const body =
      audience === "EVERYONE"
        ? `This reaches EVERY recipient in: ${targetLabels}, including people who opted out of promo notifications. Only send operational service announcements this way, never marketing.${emailLine} This cannot be undone.`
        : `This queues notifications for all promo opted-in recipients in: ${targetLabels}.${emailLine} This cannot be undone.`;

    customAlert(`Send "${slugTrimmed}"?`, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setSending(true);
            try {
              const enContent = buildLang(en);
              const csContent = csEnabled ? buildLang(cs) : null;
              const result = await callAuthed(router, (jwt) =>
                adminSendBlast({
                  jwt,
                  body: {
                    slug: slugTrimmed,
                    audience,
                    // Email-only concept: never send a picked domain with a
                    // push-only blast (the server drops it too, but the audit
                    // log should never even see one).
                    senderDomain: wantsEmail
                      ? (senderDomain ?? undefined)
                      : undefined,
                    targets,
                    channels,
                    push: enContent.push
                      ? { en: enContent.push, cs: csContent?.push }
                      : undefined,
                    email: enContent.email
                      ? { en: enContent.email, cs: csContent?.email }
                      : undefined,
                  },
                }),
              );
              if (!result.ok || !result.data) return;
              const { queued } = result.data;
              customAlert(
                queued > 0 ? "Blast queued" : "Nothing new to queue",
                queued > 0
                  ? `${queued} notification(s) queued. The worker delivers them over the next minutes; track progress in Blast history.`
                  : "An identical blast already covered every eligible recipient.",
                [{ text: "OK", onPress: () => router.back() }],
              );
            } finally {
              setSending(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.background }}>
      <TopMenu title="Send blast" showBack hideMenu />
      {/* KeyboardAware so the lower inputs (email body, CTA label — and the CS
          section's whole stack) lift above the keyboard instead of hiding
          behind it. bottomOffset is measured to the CARET, so it must clear
          ~half the 56px input plus a gap (same rationale as StepShell). */}
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        bottomOffset={spacing["3xl"]}
        contentContainerStyle={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding,
          paddingBottom: insets.bottom + layout.screenPadding,
          gap: spacing.xl,
        }}
      >
        {/* Audience */}
        <View style={{ gap: spacing.md }}>
          <Text style={[text.heading, { color: color.text.primary }]}>
            Audience
          </Text>
          <ChipRow>
            {AUDIENCE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={audience === o.value}
                onPress={() => setAudience(o.value)}
              />
            ))}
          </ChipRow>
          <Text style={[text.caption, { color: color.text.secondary }]}>
            {audience === "EVERYONE"
              ? "Everyone bypasses the promo opt-out. Operational service announcements only (rebrand, policy, incident), never marketing. Emails still carry a one-click unsubscribe (opts the account out of promo mail)."
              : "Only recipients who explicitly opted in to promo notifications. Emails render as marketing mail with a one-click unsubscribe."}
          </Text>
          <ChipRow>
            {TARGET_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={targets.includes(o.value)}
                onPress={() => toggle(setTargets, o.value)}
              />
            ))}
          </ChipRow>
        </View>

        {/* Channels */}
        <View style={{ gap: spacing.md }}>
          <Text style={[text.heading, { color: color.text.primary }]}>
            Channels
          </Text>
          <ChipRow>
            {CHANNEL_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                label={o.label}
                active={channels.includes(o.value)}
                onPress={() => toggle(setChannels, o.value)}
              />
            ))}
          </ChipRow>
        </View>

        {/* Sender identity (email leg) */}
        {wantsEmail && (
          <View style={{ gap: spacing.md }}>
            <Text style={[text.heading, { color: color.text.primary }]}>
              Email sender
            </Text>
            <ChipRow>
              <Chip
                label={
                  senderOptions
                    ? `Default (${senderOptions.defaultFromEmail})`
                    : "Default"
                }
                active={senderDomain === null}
                onPress={() => setSenderDomain(null)}
              />
              {(senderOptions?.domains ?? []).map((d) => (
                <Chip
                  key={d.domain}
                  label={d.fromEmail}
                  active={senderDomain === d.domain}
                  onPress={() => setSenderDomain(d.domain)}
                />
              ))}
            </ChipRow>
            {senderLoadFailed ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                }}
              >
                <Text
                  style={[text.caption, { color: color.danger, flexShrink: 1 }]}
                >
                  Couldn't load the verified sender domains, so only the
                  default sender is available.
                </Text>
                <Chip
                  label="Retry"
                  active={false}
                  onPress={() => void loadSenderDomains()}
                />
              </View>
            ) : (
              <Text style={[text.caption, { color: color.text.secondary }]}>
                Verified Resend domains, listed live. The server re-verifies
                the choice before queueing anything.
              </Text>
            )}
          </View>
        )}

        {/* Tracking slug */}
        <CustomTextInput
          heading="Tracking slug"
          subheading="Kebab-case identifier for this blast (e.g. rebrand-announcement). Push opens show up in PostHog under it; emails carry it as a Resend tag."
          placeholder="rebrand-announcement"
          value={slug}
          onChangeText={setSlug}
          autoCapitalize="none"
          autoCorrect={false}
          error={
            slugTrimmed.length > 0 && !slugValid
              ? "Lowercase letters, digits and single dashes only (3-40 chars)"
              : undefined
          }
        />

        {/* Emoji (applies to both languages' push titles) */}
        {wantsPush && (
          <View style={{ gap: spacing.md }}>
            <Text style={[text.heading, { color: color.text.primary }]}>
              Push title emoji
            </Text>
            <ChipRow>
              {TITLE_EMOJIS.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  active={pushEmoji === e}
                  onPress={() => setPushEmoji(pushEmoji === e ? null : e)}
                />
              ))}
            </ChipRow>
          </View>
        )}

        {/* English content (always required) */}
        <LangSection
          label="English"
          content={en}
          onChange={setEn}
          wantsPush={wantsPush}
          wantsEmail={wantsEmail}
          withEmoji={withEmoji}
        />

        {/* Czech content (optional; CS users fall back to EN without it) */}
        <View style={{ gap: spacing.md }}>
          <ChipRow>
            <Chip
              label={csEnabled ? "Czech version: on" : "Add Czech version"}
              active={csEnabled}
              onPress={() => setCsEnabled(!csEnabled)}
            />
          </ChipRow>
          {!csEnabled && (
            <Text style={[text.caption, { color: color.text.secondary }]}>
              Without a Czech version, Czech-language users receive the English
              content.
            </Text>
          )}
        </View>
        {csEnabled && (
          <LangSection
            label="Czech"
            content={cs}
            onChange={setCs}
            wantsPush={wantsPush}
            wantsEmail={wantsEmail}
            withEmoji={withEmoji}
          />
        )}

        <View style={{ gap: spacing.md }}>
          {invalidReasons.length > 0 && (
            <Text style={[text.caption, { color: color.text.secondary }]}>
              {`To send: ${invalidReasons.join(", ")}.`}
            </Text>
          )}
          <CustomButton
            type="primary"
            label="Send blast"
            icon="megaphone-outline"
            onPress={onSend}
            disabled={!isValid}
            loading={sending}
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

/** One language's content fields (push + email as selected). */
function LangSection({
  label,
  content,
  onChange,
  wantsPush,
  wantsEmail,
  withEmoji,
}: {
  label: string;
  content: LangContent;
  onChange: (c: LangContent) => void;
  wantsPush: boolean;
  wantsEmail: boolean;
  withEmoji: (title: string) => string;
}) {
  const { theme } = useTheme();
  const { color, text, spacing } = theme;
  const set = (patch: Partial<LangContent>) =>
    onChange({ ...content, ...patch });

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={[text.heading, { color: color.text.primary }]}>{label}</Text>
      {wantsPush && (
        <>
          <CustomTextInput
            heading="Push title"
            subheading={
              content.pushTitle
                ? `Will show as: ${withEmoji(content.pushTitle)}`
                : undefined
            }
            placeholder="Flaer is now Tagly"
            value={content.pushTitle}
            onChangeText={(v) => set({ pushTitle: v })}
            maxLength={100}
            // The input caps the raw title at 100, but the emoji prefix counts
            // toward the server's 100-char limit too - without this error the
            // Send button just goes dead with no explanation.
            error={
              content.pushTitle.trim().length > 0 &&
              withEmoji(content.pushTitle).length > 100
                ? "Too long once the emoji prefix is added. Shorten the title."
                : undefined
            }
          />
          <CustomTextInput
            heading="Push body"
            placeholder="Same app, new name. Your account and balance are untouched."
            value={content.pushBody}
            onChangeText={(v) => set({ pushBody: v })}
            multiline
            maxLength={300}
          />
        </>
      )}
      {wantsEmail && (
        <>
          <CustomTextInput
            heading="Email subject"
            placeholder="Flaer is now Tagly"
            value={content.emailSubject}
            onChangeText={(v) => set({ emailSubject: v })}
            maxLength={150}
          />
          <CustomTextInput
            heading="Email headline (optional)"
            subheading="The big heading inside the email. Falls back to the subject."
            placeholder="Same app, new name"
            value={content.emailTitle}
            onChangeText={(v) => set({ emailTitle: v })}
            maxLength={100}
          />
          <CustomTextInput
            heading="Preheader (optional)"
            subheading="The inbox preview line under the subject."
            placeholder="Everything about your account stays exactly the same."
            value={content.emailPreheader}
            onChangeText={(v) => set({ emailPreheader: v })}
            maxLength={200}
          />
          <CustomTextInput
            heading="Email body"
            subheading="Plain text. Each blank-line break becomes a paragraph."
            placeholder="Write the announcement..."
            value={content.emailBody}
            onChangeText={(v) => set({ emailBody: v })}
            multiline
            maxLength={3000}
          />
          <CustomTextInput
            heading="Button label (optional)"
            subheading="Adds the standard button that opens the recipient's app. No custom links."
            placeholder="Open Tagly"
            value={content.ctaLabel}
            onChangeText={(v) => set({ ctaLabel: v })}
            maxLength={60}
          />
        </>
      )}
    </View>
  );
}

/** Wrapping row of selector chips. */
function ChipRow({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

/** Standard selected-pill chip: ink fill active, white + chip shadow inactive. */
function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, shadow, radius } = theme;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.pill,
          backgroundColor: active ? color.ink : color.surface,
          ...(active ? {} : { boxShadow: shadow.chip }),
        },
        pressFeedbackStyle({ pressed, hovered }),
      ]}
    >
      <Text
        style={[
          text.label,
          { color: active ? color.on.ink : color.text.secondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
