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
  adminSetCustomerBanned,
  adminSetCustomerMultiplier,
} from "@tagly/sdk/v2/adminApp";
import type { AdminCustomer } from "@tagly/models/v2/adminApp";
import { formatBpsMultiplier } from "@/components/details/DetailKit";

/**
 * Customer actions for the admin customer detail screen: ban/unban (Account
 * section) and the rating-multiplier set (Rewards section). SUPER-only
 * mutations, confirm-guarded per the destructive-actions rule; the server owns
 * the real gates (status checks, multiplier bounds) and callAuthed surfaces
 * its rejections as alerts. `onDone` refetches the customer.
 */

/** Ban (sheet with the required reason) / unban (confirm only). */
export function BanCustomerButton({
  customer,
  onDone,
}: {
  customer: AdminCustomer;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { spacing, text, color } = theme;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const banning = customer.status !== "BANNED";

  const run = (body: { banned: boolean; reason?: string }) => {
    void (async () => {
      setBusy(true);
      const res = await callAuthed(router, (jwt) =>
        adminSetCustomerBanned({
          jwt,
          params: { uid: customer.uid },
          body,
        }),
      );
      setBusy(false);
      if (res.ok && res.data) {
        setOpen(false);
        setReason("");
        onDone();
      }
    })();
  };

  const submitBan = () => {
    if (!reason.trim()) return;
    customAlert(
      "Ban this customer?",
      `${customer.email} keeps their account but cannot create shares or withdraw money, and their Instagram is blocked from ever re-registering. They get an email with your reason. Shares already in flight still settle.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ban",
          style: "destructive",
          onPress: () => run({ banned: true, reason: reason.trim() }),
        },
      ],
    );
  };

  const submitUnban = () => {
    customAlert(
      "Unban this customer?",
      `${customer.email} can create shares and withdraw again, and their Instagram comes off the block list. They get an email.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unban", onPress: () => run({ banned: false }) },
      ],
    );
  };

  return (
    <>
      <View style={{ flexBasis: "100%" }}>
        <CustomButton
          type={banning ? "destructive" : "secondary"}
          label={banning ? "Ban customer" : "Unban customer"}
          icon={banning ? "hand-left-outline" : "checkmark-circle-outline"}
          onPress={banning ? () => setOpen(true) : submitUnban}
          loading={busy && !open}
        />
      </View>

      <BottomSheet open={open} onClose={busy ? undefined : () => setOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            Ban customer
          </Text>
          <CustomTextInput
            heading="Reason"
            subheading="Emailed to the customer and shown in their app as the ban reason."
            placeholder="Why is this customer being banned?"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <CustomButton
            type="destructive"
            label="Ban customer"
            onPress={submitBan}
            disabled={!reason.trim()}
            loading={busy}
          />
        </View>
      </BottomSheet>
    </>
  );
}

/** `"0.85"` (a multiplier in x) → 8500 bps; null when not a valid number. */
function parseMultiplierToBps(raw: string): number | null {
  const cleaned = raw.replace(/[x\s]/gi, "").replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const bps = Math.round(parseFloat(cleaned) * 10000);
  return bps > 0 ? bps : null;
}

/** Absolute set of the rating multiplier (input as "0.85"-style x value). */
export function SetMultiplierButton({
  customer,
  onDone,
}: {
  customer: AdminCustomer;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const { spacing, text, color } = theme;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const currentBps = customer.sensitiveData.multiplierBps;
  const bps = parseMultiplierToBps(value);
  const valid = bps != null;

  const submit = () => {
    if (bps == null) return;
    customAlert(
      `Set multiplier to ${formatBpsMultiplier(bps)}?`,
      `${customer.email}'s reward multiplier changes from ${formatBpsMultiplier(currentBps)} to ${formatBpsMultiplier(bps)}. This scales every future reward estimate and payout for them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set multiplier",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const res = await callAuthed(router, (jwt) =>
                adminSetCustomerMultiplier({
                  jwt,
                  params: { uid: customer.uid },
                  body: { multiplierBps: bps },
                }),
              );
              setBusy(false);
              if (res.ok && res.data) {
                setOpen(false);
                setValue("");
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
          label="Set multiplier"
          icon="speedometer-outline"
          onPress={() => {
            setValue((currentBps / 10000).toString());
            setOpen(true);
          }}
        />
      </View>

      <BottomSheet open={open} onClose={busy ? undefined : () => setOpen(false)}>
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            Set rating multiplier
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            Current: {formatBpsMultiplier(currentBps)}. The server rejects
            values outside the rating algorithm's allowed range.
          </Text>
          <CustomTextInput
            heading="Multiplier"
            placeholder="1.0"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            error={
              value.trim() && !valid ? "Enter a value like 0.85 or 1.1" : undefined
            }
          />
          <CustomButton
            type="primary"
            label="Set multiplier"
            onPress={submit}
            disabled={!valid}
            loading={busy}
          />
        </View>
      </BottomSheet>
    </>
  );
}
