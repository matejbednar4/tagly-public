import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useTheme } from "@tagly/client";
import { useAdvertiser } from "@/contexts/advertiser/AdvertiserContext";
import { useFundingState } from "@/components/billing/shared/useFundingState";
import { useSheetRouter } from "@/components/billing/shared/useSheetRouter";
import { AddCreditsSheet } from "@/components/billing/AddCreditsSheet";
import { MonthlyTopUpSheet } from "@/components/billing/MonthlyTopUpSheet";
import { PaygSheet } from "@/components/billing/PaygSheet";
import { CardSheet } from "@/components/billing/CardSheet";
import { SettleBalanceSheet } from "@/components/billing/SettleBalanceSheet";
import { BalanceCard } from "./BalanceCard";
import { HowYouPayCard } from "./HowYouPayCard";
import { FundingPitch } from "./FundingPitch";
import { useAnalytics, type BillingSurface } from "@/utils/analytics";

/**
 * THE funding surface — the whole "how this account pays" body, mounted
 * verbatim by both the Wallet tab and the onboarding payment step so the two
 * cannot drift (Matej, 2026-09-02: "the onboarding payments screen should look
 * exactly the same as the wallet"). Hosts add only their own chrome: the Wallet
 * wraps it in the top bar, the visibility strip and the transactions feed; the
 * setup step wraps it in the step overline, title and skip.
 *
 * Two states, one gate — the server-derived `funded` fact:
 * - **Never funded** → `FundingPitch`, the prepay-or-pay-per-share fork. The
 *   only time the wallet sells.
 * - **Funded** → `BalanceCard` (balance facts and their actions) over
 *   `HowYouPayCard` (the three rules as rows). Reporting, not selling.
 *
 * It also **owns every billing sheet**, which is what makes the shared body
 * possible: a host that had to wire five sheets itself would inevitably wire
 * them slightly differently. Hosts get two callbacks — `onFunded` (confirmed
 * new money: a purchase, a rule turned on, a settled debt) and `onChanged`
 * (state moved without new funding) — and pass `surface` for the money events.
 *
 * **`onFunded` fires only once the surface is empty.** A host may move on in
 * it (the setup step resolves its gate there, swapping the whole screen), so
 * handing back while a sheet is still up would tear down the confirmation the
 * advertiser is reading — or the follow-up prompt about to open. Funded exits
 * therefore record the hand-back and close; `sheetClosed` pays it when no sheet
 * is left. This is the same reason the setup gate latches once entered
 * (`AdvertiserContext`).
 *
 * Sheets hand work to each other through the surface rather than nesting:
 * anything about the card itself opens `CardSheet`, so the rule sheets never
 * grow their own card UI.
 */
export function FundingSurface({
  surface,
  onFunded,
  onChanged,
}: {
  /** Which host mounted it — stamped on every money event. */
  surface: BillingSurface;
  /** Confirmed new funding (purchase, rule enabled, debt settled). */
  onFunded: () => void;
  /** State changed without new funding (rule off, card replaced/removed). */
  onChanged?: () => void;
}) {
  const { theme } = useTheme();
  const { spacing } = theme;
  const { track } = useAnalytics();
  const funding = useFundingState();

  // One sheet at a time; a hand-off ("Manage card" inside a rule sheet) waits
  // for the outgoing Modal to unmount before mounting the next one.
  const {
    sheet,
    open: openSheetRaw,
    close,
    swapTo,
    handleClosed,
  } = useSheetRouter<"credits" | "monthly" | "payg" | "card" | "settle">();

  /**
   * Offer the monthly top-up right after a purchase — **on every surface,
   * onboarding included** (Matej, 2026-09-03): a just-completed payment is the
   * moment the rule explains itself, and the setup step is where the habit is
   * most worth forming.
   *
   * Only when the rule is genuinely off — never when it's already running, and
   * not while it's paused on a declined card, where the sheet would open on a
   * card error instead of a pitch.
   */
  const promptMonthlyAfterPurchase = funding.monthly.status === "NOT_ACTIVE";

  /**
   * A confirmed-funding hand-back the surface is holding until it is empty.
   *
   * `onFunded` can move the host on (the setup step resolves its gate in it,
   * which swaps the whole screen), so firing it while a sheet is still up —
   * mid success-beat, or with the monthly prompt about to open — destroys the
   * very thing the advertiser is looking at. So a funded exit records the debt
   * and closes; `sheetClosed` pays it once nothing is left on screen.
   */
  const heldFunded = useRef(false);

  /**
   * Holds the onboarding payment gate open for the whole time this surface has
   * something on screen. A sheet's own `/me` refresh flips `funded` the instant
   * money lands, and the gate would otherwise unmount the sheet mid-flow.
   *
   * **Spans the chain, not one sheet.** Keying this off `sheet !== null` was a
   * bug: `swapTo` sets `sheet` to null on purpose so the outgoing Modal can
   * unmount before the next mounts, so the hold dropped inside the hand-off gap
   * — the gate then swapped the step away before the monthly prompt mounted, no
   * prompt appeared, and `onFunded` (hence `dismissPaymentSetup`) never fired.
   * It stays true from the first open until `sheetClosed` finds nothing queued.
   *
   * **Setup only.** Nowhere else has a gate to hold, and holding elsewhere is
   * actively harmful: on the Wallet it flipped `paymentSetupPending` true while
   * a sheet was open, bouncing the tab out to `/setup` and back to Home.
   */
  const { holdPaymentSetup } = useAdvertiser();
  const [chainActive, setChainActive] = useState(false);
  useEffect(() => {
    if (surface !== "setup") return;
    holdPaymentSetup(chainActive);
    return () => holdPaymentSetup(false);
  }, [surface, chainActive, holdPaymentSetup]);

  /** Open a sheet and mark the chain active for the gate hold. */
  const openSheet = (key: Parameters<typeof openSheetRaw>[0]) => {
    setChainActive(true);
    openSheetRaw(key);
  };

  /** Whether the monthly sheet was reached from a purchase (it then leads with
   *  the offer's question) or opened from its row (the method's own words). */
  const [monthlyAfterPurchase, setMonthlyAfterPurchase] = useState(false);

  /** Every sheet's `onClosed`. Continues a hand-off if one is queued; only when
   *  the surface is genuinely empty does the host get its callback. */
  const sheetClosed = () => {
    if (handleClosed()) return; // a hand-off is queued — the chain continues
    setChainActive(false); // surface empty: the gate may resolve again
    if (!heldFunded.current) return;
    heldFunded.current = false;
    onFunded();
  };

  /** A sheet confirmed new money: close it, and hand back once it's gone. */
  const fundedThenClose = () => {
    heldFunded.current = true;
    close();
  };

  /** The setup step's funnel middle: which fork option was opened. Fired here
   *  rather than in the host, so the step cannot forget it now that the host
   *  no longer owns the cards. */
  const openFromPitch = (mode: "credits" | "payg") => {
    if (surface === "setup") track("setup_payment_mode_selected", { mode });
    openSheet(mode === "credits" ? "credits" : "payg");
  };

  return (
    <>
      <View style={{ gap: spacing.lg }}>
        {funding.funded ? (
          <>
            <BalanceCard
              funding={funding}
              onAddCredits={() => openSheet("credits")}
              onPayBalance={() => openSheet("settle")}
            />
            <HowYouPayCard
              funding={funding}
              onMonthly={() => {
                setMonthlyAfterPurchase(false);
                openSheet("monthly");
              }}
              onPayg={() => openSheet("payg")}
              onCard={() => openSheet("card")}
            />
          </>
        ) : (
          <FundingPitch
            onAddCredits={() => openFromPitch("credits")}
            onPayg={() => openFromPitch("payg")}
          />
        )}
      </View>

      <AddCreditsSheet
        open={sheet === "credits"}
        onClose={close}
        onClosed={sheetClosed}
        onPurchased={() => {
          // A purchase is the one moment the monthly top-up sells itself: they
          // just chose an amount and paid it, so "have that happen every month"
          // needs no explaining. Hand off to the sheet that owns the rule
          // rather than pitching it here — `swapTo` waits for this Modal to
          // unmount first (two mounted Modals freeze the screen), and the
          // host's hand-back waits for the prompt to be answered.
          heldFunded.current = true;
          if (promptMonthlyAfterPurchase) {
            setMonthlyAfterPurchase(true);
            swapTo("monthly");
          } else close();
        }}
        surface={surface}
      />
      <MonthlyTopUpSheet
        open={sheet === "monthly"}
        afterPurchase={monthlyAfterPurchase}
        onClose={close}
        onEnabled={fundedThenClose}
        onChanged={onChanged}
        onOpenCard={() => swapTo("card")}
        onClosed={sheetClosed}
        surface={surface}
      />
      <PaygSheet
        open={sheet === "payg"}
        onClose={close}
        onLinked={fundedThenClose}
        onChanged={onChanged}
        onOpenCard={() => swapTo("card")}
        onClosed={sheetClosed}
        surface={surface}
      />
      <CardSheet
        open={sheet === "card"}
        onClose={close}
        onClosed={sheetClosed}
        onChanged={() => onChanged?.()}
        surface={surface}
      />
      <SettleBalanceSheet
        open={sheet === "settle"}
        onClose={close}
        onClosed={sheetClosed}
        onSettled={fundedThenClose}
        surface={surface}
      />
    </>
  );
}
