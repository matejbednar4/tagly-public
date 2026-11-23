import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  useTheme,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  BottomSheet,
} from "@tagly/client";
import {
  adminSetBusinessSubsidized,
  adminSetBusinessBanned,
  adminSetBusinessAdvertiser,
} from "@tagly/sdk/v2/adminApp";
import type { AdminBusiness } from "@tagly/models/v2/adminApp";
import { AdvertiserUidSchema, type AdvertiserUid } from "@tagly/models/shared";

/**
 * Business actions for the admin business detail screen: subsidize/end
 * subsidization (Subsidization section), ban/unban (Info area), and the
 * onboarding-assist advertiser handover (Advertiser section). All SUPER-only
 * mutations; every submit is confirm-guarded per the destructive-actions rule
 * and the server owns the real gates (owned-XOR-subsidized, never-subsidized +
 * zero-shares for assign, status CAS) — callAuthed surfaces its rejections as
 * alerts. `onDone` refetches the business so badges/sections stay current.
 */

/** Subsidize / end subsidization. Rendered only for UNOWNED pages. */
export function SubsidizeButton({
  business,
  onDone,
}: {
  business: AdminBusiness;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Owned pages can never be subsidized (owned XOR subsidized) — the caller
  // hides the button, this is the belt-and-braces.
  if (business.advertiser) return null;

  const subsidizing = !business.isSubsidized;
  // Subsidizing requires ACTIVE (server-enforced too); ending works regardless
  // of status so a banned page's period can still be closed.
  if (subsidizing && business.status !== "ACTIVE") return null;

  const run = () => {
    const title = subsidizing ? "Subsidize this page?" : "End subsidization?";
    const body = subsidizing
      ? `Tagly will pay for ${business.name}'s shares (up to the subsidized share limit) until you end the subsidization.`
      : `${business.name} stops being shareable (it has no advertiser budget). Shares already in flight still settle as subsidized.`;
    customAlert(title, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: subsidizing ? "Subsidize" : "End subsidization",
        style: subsidizing ? "default" : "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            const res = await callAuthed(router, (jwt) =>
              adminSetBusinessSubsidized({
                jwt,
                params: { uid: business.uid },
                body: { isSubsidized: subsidizing },
              }),
            );
            setBusy(false);
            if (res.ok && res.data) onDone();
          })();
        },
      },
    ]);
  };

  return (
    <View style={{ flexBasis: "100%" }}>
      <CustomButton
        type="secondary"
        label={subsidizing ? "Subsidize" : "End subsidization"}
        icon="sparkles-outline"
        onPress={run}
        loading={busy}
      />
    </View>
  );
}

/** Ban / unban. Rendered for ACTIVE and BANNED pages (never DELETED). */
export function BanButton({
  business,
  onDone,
}: {
  business: AdminBusiness;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (business.status === "DELETED") return null;
  const banning = business.status === "ACTIVE";

  const run = () => {
    const title = banning ? "Ban this page?" : "Unban this page?";
    const body = banning
      ? `${business.name} disappears for customers immediately. The owner still sees it (read only) and shares already in flight still settle.`
      : `${business.name} becomes visible to customers again.`;
    customAlert(title, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: banning ? "Ban" : "Unban",
        style: banning ? "destructive" : "default",
        onPress: () => {
          void (async () => {
            setBusy(true);
            const res = await callAuthed(router, (jwt) =>
              adminSetBusinessBanned({
                jwt,
                params: { uid: business.uid },
                body: { banned: banning },
              }),
            );
            setBusy(false);
            if (res.ok && res.data) onDone();
          })();
        },
      },
    ]);
  };

  return (
    <View style={{ flexBasis: "100%" }}>
      <CustomButton
        type={banning ? "destructive" : "secondary"}
        label={banning ? "Ban business" : "Unban business"}
        icon={banning ? "hand-left-outline" : "checkmark-circle-outline"}
        onPress={run}
        loading={busy}
      />
    </View>
  );
}

/**
 * The onboarding-assist handover: assign this admin-created unowned page to
 * an advertiser (they skipped the business-page setup step; we made the page
 * for them). Rendered ONLY when the client-side mirror of the server's hard
 * gates passes: unowned, ACTIVE, never subsidized (no periods at all), never
 * any shares. The server re-enforces all of it.
 */
export function AssignAdvertiserButton({
  business,
  onDone,
}: {
  business: AdminBusiness;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { spacing, text, color } = theme;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [uidInput, setUidInput] = useState("");
  const [busy, setBusy] = useState(false);

  const eligible =
    !business.advertiser &&
    business.status === "ACTIVE" &&
    business.subsidizationPeriods.length === 0 &&
    business.statistics.totalShares === 0;
  if (!eligible) return null;

  const parsed = AdvertiserUidSchema.safeParse(uidInput.trim());
  const valid = parsed.success;

  const submit = () => {
    if (!valid) return;
    const advertiserUid = parsed.data as AdvertiserUid;
    customAlert(
      "Assign this page?",
      `${business.name} becomes ${advertiserUid}'s own business page. They will see and edit it in their app and fund it with their own budget. This is meant for pages we created for them during onboarding.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Assign",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const res = await callAuthed(router, (jwt) =>
                adminSetBusinessAdvertiser({
                  jwt,
                  params: { uid: business.uid },
                  body: { advertiserUid },
                }),
              );
              setBusy(false);
              if (res.ok && res.data) {
                setOpen(false);
                setUidInput("");
                onDone();
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={{ flexBasis: "100%" }}>
        <CustomButton
          type="secondary"
          label="Assign to advertiser"
          icon="briefcase-outline"
          onPress={() => setOpen(true)}
        />
      </View>

      <BottomSheet open={open} onClose={busy ? undefined : () => setOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            Assign to advertiser
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            The onboarding handover: give this page to the advertiser we
            created it for. Copy their UID from the advertiser detail screen.
            Works only while the page has never been subsidized and has no
            shares; the advertiser must be in the same country.
          </Text>
          <CustomTextInput
            heading="Advertiser UID"
            placeholder="a..."
            value={uidInput}
            onChangeText={setUidInput}
            autoCapitalize="none"
            autoCorrect={false}
            error={
              uidInput.trim() && !valid
                ? "That does not look like an advertiser UID"
                : undefined
            }
          />
          <CustomButton
            type="primary"
            label="Assign page"
            onPress={submit}
            disabled={!valid}
            loading={busy}
          />
        </View>
      </BottomSheet>
    </>
  );
}
