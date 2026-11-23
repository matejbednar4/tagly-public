import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useTheme,
  callAuthed,
  customAlert,
  CustomButton,
  CustomTextInput,
  BottomSheet,
  pressFeedbackStyle,
} from "@tagly/client";
import {
  adminGetBusinessQrStickers,
  adminAssignQrSticker,
  adminUnassignQrSticker,
} from "@tagly/sdk/v2/adminApp";
import type { AdminQrSticker } from "@tagly/models/v2/adminApp";
import type { LocalSubaccountUid } from "@tagly/models/shared";
import { QrStickerIdSchema } from "@tagly/models/shared";
import { StatSection } from "@/components/statistics/StatKit";
import { formatDateTime } from "@/utils/format";

/**
 * "QR stickers" section for the admin business detail screen: the printed
 * physical stickers (numbered 000001+) currently hanging in this business.
 * Renders the assigned numbers as a chip list (tap a chip → note + assigned
 * date + a confirm-guarded Remove that hard-deletes the mapping, i.e. "the
 * sticker was physically taken down") and an "Add sticker" sheet (number +
 * optional note). A sticker already hanging in a DIFFERENT business is refused
 * by the server (409, code 5310, message names that business) — the section
 * surfaces it as a confirm and retries with `reassign: true` on approval.
 * Owns its own fetch (focus-refetch, like the host screen's business fetch)
 * so the host only passes the business uid.
 */

// Backend domain code: sticker is already assigned to a different business
// (409 on PUT /v2/admin/stickers/:id without `reassign`).
const STICKER_ASSIGNED_ELSEWHERE = 5310;

// Canonical sticker-id formatting comes from @tagly/models core/qrStickers.

export function QrStickerSection({
  businessUid,
}: {
  businessUid: LocalSubaccountUid;
}) {
  const { theme } = useTheme();
  const { color, text, spacing, layout, shadow, radius } = theme;
  const router = useRouter();

  const [stickers, setStickers] = useState<AdminQrSticker[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Add-sticker sheet state.
  const [open, setOpen] = useState(false);
  const [idInput, setIdInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchStickers = useCallback(async () => {
    const res = await callAuthed(
      router,
      (jwt) => adminGetBusinessQrStickers({ jwt, params: { uid: businessUid } }),
      { suppressAlerts: true },
    );
    if (res.ok && res.data) setStickers(res.data.stickers);
  }, [router, businessUid]);

  // Refetch on every focus, mirroring the host screen's business fetch.
  useFocusEffect(
    useCallback(() => {
      void fetchStickers();
    }, [fetchStickers]),
  );

  // Sticker ids are OPAQUE strings matched exactly as printed ("000001" or a
  // future random id like "yf5h8ayui21r") — no padding, no normalization.
  const trimmedId = idInput.trim();
  const valid = QrStickerIdSchema.safeParse(trimmedId).success;

  const closeSheet = () => {
    setOpen(false);
    setIdInput("");
    setNoteInput("");
  };

  const submit = (reassign: boolean) => {
    if (!valid || busy) return;
    const stickerId = trimmedId;
    const note = noteInput.trim();
    void (async () => {
      setBusy(true);
      const res = await callAuthed(
        router,
        (jwt) =>
          adminAssignQrSticker({
            jwt,
            params: { id: stickerId },
            body: {
              businessUid,
              ...(note ? { note } : null),
              ...(reassign ? { reassign: true } : null),
            },
          }),
        { handleSpecificErrorManually: true },
      );
      setBusy(false);
      if (res.ok) {
        closeSheet();
        void fetchStickers();
        return;
      }
      const err = res.error?.error;
      if (err?.code === STICKER_ASSIGNED_ELSEWHERE) {
        // The server message names the business currently holding the sticker.
        customAlert(
          "Sticker already assigned",
          `${err.message} Move it to this business instead?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Move it here",
              style: "destructive",
              onPress: () => submit(true),
            },
          ],
        );
        return;
      }
      // Other domain codes are suppressed by handleSpecificErrorManually —
      // surface them here (non-domain errors were already alerted centrally).
      if (err && typeof err.code === "number" && err.code >= 1000) {
        customAlert("Could not assign sticker", err.message);
      }
    })();
  };

  const confirmRemove = (s: AdminQrSticker) => {
    customAlert(
      `Remove sticker ${s.stickerId}?`,
      "The number stops pointing to this business. Do this when the printed sticker has been physically taken down.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setRemovingId(s.stickerId);
              const res = await callAuthed(router, (jwt) =>
                adminUnassignQrSticker({ jwt, params: { id: s.stickerId } }),
              );
              setRemovingId(null);
              if (res.ok) void fetchStickers();
            })();
          },
        },
      ],
    );
  };

  const showSticker = (s: AdminQrSticker) => {
    const body = [
      s.note ? `Note: ${s.note}` : null,
      `Assigned: ${formatDateTime(s.assignedAt)}`,
    ]
      .filter(Boolean)
      .join("\n");
    customAlert(`Sticker ${s.stickerId}`, body, [
      { text: "Close", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => confirmRemove(s) },
    ]);
  };

  return (
    <StatSection
      title="QR stickers"
      icon="qr-code-outline"
      tint="brand"
      summary={stickers ? String(stickers.length) : undefined}
    >
      <View style={{ flexBasis: "100%" }}>
        {stickers == null ? (
          <Text style={[text.caption, { color: color.text.tertiary }]}>
            Loading stickers...
          </Text>
        ) : stickers.length === 0 ? (
          <Text style={[text.caption, { color: color.text.tertiary }]}>
            No stickers assigned yet.
          </Text>
        ) : (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}
          >
            {stickers.map((s) => (
              <Pressable
                key={s.stickerId}
                onPress={() => showSticker(s)}
                disabled={removingId === s.stickerId}
                accessibilityRole="button"
                accessibilityLabel={`Sticker ${s.stickerId}`}
                style={({ pressed, hovered }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xs,
                    minHeight: layout.minTapTarget,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.pill,
                    backgroundColor: color.surface,
                    boxShadow: shadow.chip,
                    opacity: removingId === s.stickerId ? 0.5 : 1,
                  },
                  pressFeedbackStyle({ pressed, hovered }),
                ]}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={14}
                  color={color.text.tertiary}
                />
                <Text style={[text.label, { color: color.text.primary }]}>
                  {s.stickerId}
                </Text>
                {s.note ? (
                  <Ionicons
                    name="document-text-outline"
                    size={14}
                    color={color.text.tertiary}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexBasis: "100%" }}>
        <CustomButton
          type="secondary"
          label="Add sticker"
          icon="add"
          onPress={() => setOpen(true)}
        />
      </View>

      <BottomSheet open={open} onClose={busy ? undefined : closeSheet}>
        <View style={{ gap: spacing.lg }}>
          <Text style={[text.title, { color: color.text.primary }]}>
            Add sticker
          </Text>
          <Text style={[text.body, { color: color.text.secondary }]}>
            Type the number printed on the physical sticker to assign it to
            this business.
          </Text>
          <CustomTextInput
            heading="Sticker ID"
            placeholder="Exactly as printed, e.g. 000123"
            value={idInput}
            onChangeText={setIdInput}
            onBlur={() => {
              // Printed stickers read 000001...; typing "1" means that same
              // sticker, so normalize the field to the padded form the admin
              // is holding in their hand.
            }}
            keyboardType="number-pad"
            autoCorrect={false}
            error={
              trimmedId && !valid
                ? "Enter a number between 1 and 999999"
                : undefined
            }
          />
          <CustomTextInput
            heading="Note (optional)"
            placeholder="e.g. by the entrance"
            value={noteInput}
            onChangeText={setNoteInput}
            maxLength={200}
          />
          <CustomButton
            type="primary"
            label="Assign sticker"
            onPress={() => submit(false)}
            disabled={!valid}
            loading={busy}
          />
        </View>
      </BottomSheet>
    </StatSection>
  );
}
