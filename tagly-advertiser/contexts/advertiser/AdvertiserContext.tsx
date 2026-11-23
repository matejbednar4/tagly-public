import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useRouter } from "expo-router";
import { callAuthed, localGet, localStore, localDelete } from "@tagly/client";
import type { AdvertiserMe } from "@tagly/models/v2/advertiserApp";
import { getMe } from "@tagly/sdk/v2/advertiserApp";
import { LOCAL_KEYS } from "@/constants/storageKeys";

interface AdvertiserContextValue {
  /** The logged-in advertiser's lean profile, or null when the fetch failed. */
  advertiser: AdvertiserMe | null;
  /** False until the first /me fetch + local setup flags resolve (the (app) gate holds on this). */
  ready: boolean;
  /** Re-fetch /me (e.g. after a mutation that changes profile facts). */
  refresh: () => Promise<void>;
  /**
   * Patch the cached advertiser in place (e.g. the app-open re-acceptance
   * modals flip `shouldAgreeWithLatest*` false on accept without a refetch —
   * a later `refresh` returns false too, since the backend stamped agreed-at).
   */
  setAdvertiser: Dispatch<SetStateAction<AdvertiserMe | null>>;
  /**
   * Whether the setup payment step should show: unfunded AND not dismissed on
   * this device. The (app) gate routes into `/setup` while true. **Latched
   * once shown** — funding from inside the step does not close it; only
   * `dismissPaymentSetup` does (see the derivation below).
   */
  paymentSetupPending: boolean;
  /**
   * Resolve the payment step on this device (funded via the sheet, or skipped).
   * Sets the device-local flag — instant, no network — which advances the
   * setup stack to the business-page step.
   */
  dismissPaymentSetup: () => void;
  /**
   * Hold the payment step open while a billing sheet is on screen, so a `/me`
   * refresh mid-flow can't unmount the sheet that triggered it. Driven by
   * `FundingSurface`; see `paymentSetupPending` for why it is a hold and not a
   * latch.
   */
  holdPaymentSetup: (held: boolean) => void;
  /**
   * Whether the setup business-page step should show: no business page yet AND
   * not dismissed on this device.
   */
  businessSetupPending: boolean;
  /** Resolve the business-page step (created one, or skipped). */
  dismissBusinessSetup: () => void;
}

const AdvertiserContext = createContext<AdvertiserContextValue | undefined>(
  undefined,
);

export function useAdvertiser() {
  const ctx = useContext(AdvertiserContext);
  if (!ctx) {
    throw new Error("useAdvertiser must be used within AdvertiserProvider");
  }
  return ctx;
}

/**
 * Owns the logged-in advertiser's core profile (`GET /v2/advertisers/me`) and
 * the setup-phase gate state. Mounted in `app/(app)/_layout.tsx`.
 *
 * The gate splits its facts by owner: the server derives what is objectively
 * true (`funded`, `hasBusinessPage`), the device stores what the user chose
 * ("skip for now" — `PAYMENT_SETUP_DISMISSED`). A step shows only while its
 * fact is unsatisfied and undismissed, so a funded account (crash recovery
 * after a paid PaymentSheet, a migrated v1 account) is never asked to pay
 * again, while a skip never nags within this install. The payment step then
 * **latches**: entering it hands it its own exit, so the fact turning true
 * mid-step cannot yank the screen away (see `paymentSetupPending` below).
 *
 * The boot fetch is deliberately quiet and **fail-open**: a transient /me
 * failure sets `advertiser: null` (no alert) and the gate lets the user into
 * the tabs rather than blocking the whole app on one read — the Wallet tab is
 * the permanent second chance.
 */
export function AdvertiserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [advertiser, setAdvertiser] = useState<AdvertiserMe | null>(null);
  const [paymentDismissed, setPaymentDismissed] = useState(false);
  const [businessDismissed, setBusinessDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const res = await callAuthed(router, (jwt) => getMe({ jwt }), {
      suppressAlerts: true,
    });
    setAdvertiser(res.ok && res.data ? res.data.advertiser : null);
    // Action closures read the router on call; identity is stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const [, paymentFlag, businessFlag] = await Promise.all([
        refresh(),
        localGet(LOCAL_KEYS.PAYMENT_SETUP_DISMISSED),
        localGet(LOCAL_KEYS.BUSINESS_SETUP_DISMISSED),
      ]);
      setPaymentDismissed(!!paymentFlag);
      setBusinessDismissed(!!businessFlag);
      setReady(true);
    })();
  }, [refresh]);

  const dismissPaymentSetup = () => {
    setPaymentDismissed(true); // advances the setup stack
    void localStore(LOCAL_KEYS.PAYMENT_SETUP_DISMISSED, "1");
  };

  const dismissBusinessSetup = () => {
    setBusinessDismissed(true); // flips the gate to the tabs when last
    void localStore(LOCAL_KEYS.BUSINESS_SETUP_DISMISSED, "1");
    // The step-overline baseline has served its purpose — the business-page
    // step is the last counted one (see useSetupProgress).
    void localDelete(LOCAL_KEYS.SETUP_STEP_BASE);
  };

  // The raw fact: should this account be ASKED to fund?
  const paymentUnsatisfied =
    !!advertiser && !advertiser.funded && !paymentDismissed;

  /**
   * The step, once on screen, must not be yanked away mid-flow: every billing
   * sheet refreshes `/me` the moment money is confirmed, so `funded` flips true
   * while the success beat is still playing. Left to the raw fact alone, the
   * guard swapped the step out from under its own sheet — the confirmation was
   * cut off, `onPurchased` never fired (its timer dies with the unmount), and
   * whatever the step meant to do next died with it.
   *
   * So the hold is exactly as wide as the danger: **entered the step AND a
   * sheet is currently open** (`holdPaymentSetup`, driven by `FundingSurface`).
   * It deliberately is NOT a one-way latch — that pinned a funded advertiser to
   * this step for the rest of the session whenever `onFunded` never fired, the
   * reachable case being a purchase that exhausts its verify poll (`unverified`)
   * while the webhook books the credits anyway. With the hold scoped to an open
   * sheet, that account simply falls through to the tabs once the sheet closes.
   */
  const enteredPaymentSetup = useRef(false);
  const [paymentHold, setPaymentHold] = useState(false);
  useEffect(() => {
    if (paymentUnsatisfied) enteredPaymentSetup.current = true;
  }, [paymentUnsatisfied]);

  const paymentSetupPending =
    !paymentDismissed &&
    (paymentUnsatisfied || (enteredPaymentSetup.current && paymentHold));
  const businessSetupPending =
    !!advertiser && !advertiser.hasBusinessPage && !businessDismissed;

  const value = useMemo<AdvertiserContextValue>(
    () => ({
      advertiser,
      ready,
      refresh,
      setAdvertiser,
      paymentSetupPending,
      dismissPaymentSetup,
      holdPaymentSetup: setPaymentHold,
      businessSetupPending,
      dismissBusinessSetup,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [advertiser, ready, paymentSetupPending, businessSetupPending],
  );

  return (
    <AdvertiserContext.Provider value={value}>
      {children}
    </AdvertiserContext.Provider>
  );
}
