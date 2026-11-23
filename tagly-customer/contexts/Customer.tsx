import { CustomerMe } from "@tagly/models/v2/customerApp";
import { getMe } from "@tagly/sdk/v2/customerApp";
import { callAuthed } from "@tagly/client";
import { useRouter } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useSession } from "@/contexts/session/SessionContext";

/**
 * Holds the logged-in customer's lean core profile (`CustomerMe`, from
 * `GET /v2/customers/me`) and owns the fetch. `reloadCustomer` (re)loads it —
 * called on app open and reusable anywhere (pull-to-refresh, after an edit).
 * Instagram-specific state/actions live in `InstagramConnectionContext`, which
 * patches `customer.instagram` through `setCustomer`.
 */
const CustomerContext = createContext<{
  customer: CustomerMe | undefined;
  setCustomer: React.Dispatch<React.SetStateAction<CustomerMe | undefined>>;
  /** Fetch `/me` into context; returns it, or null on failure (signs out only when the account no longer exists). */
  reloadCustomer: () => Promise<CustomerMe | null>;
}>({
  customer: undefined,
  setCustomer: () => {},
  reloadCustomer: async () => null,
});

export const useCustomer = () => useContext(CustomerContext);

export const CustomerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const { signOut } = useSession();
  const [customer, setCustomer] = useState<CustomerMe | undefined>(undefined);

  const reloadCustomer = useCallback(async (): Promise<CustomerMe | null> => {
    const result = await callAuthed(router, (jwt) => getMe({ jwt }));
    if (!result.ok) {
      // Sign out ONLY when the session is genuinely dead: a valid JWT whose
      // account row is gone — 404 + domain 4043 ("Customer not found", the one
      // error `hydrateCustomerMe` throws). 401 is already handled inside
      // callAuthed. Every other status here is transient or protocol-level and
      // must keep the session: the SDK's own 408 timeout, a 429 rate limit,
      // and above all 426 (forced update) — the update wall is already up, and
      // signing out under it would log out and de-push every outdated build
      // when the min-version gate is raised (E040).
      if (result.status === 404 && result.error?.error.code === 4043) {
        await signOut();
      }
      return null;
    }
    if (!result.data) return null; // 304 — nothing new to store
    setCustomer(result.data.customer);
    return result.data.customer;
  }, [router, signOut]);

  const value = useMemo(
    () => ({ customer, setCustomer, reloadCustomer }),
    [customer, reloadCustomer]
  );

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  );
};
