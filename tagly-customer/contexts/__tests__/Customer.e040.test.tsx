/**
 * E040 drive: `reloadCustomer` must sign out ONLY on a genuinely dead session
 * (404 + domain 4043 "Customer not found"), never on transient/protocol
 * statuses — the SDK's own 408 timeout, a 429 rate limit, or the 426
 * forced-update response (which must leave the session intact behind the
 * update wall).
 *
 * Verification scratch for the v2-review fix session — drives the REAL
 * CustomerProvider with `callAuthed` stubbed per status. Red on the old
 * shape (signs out on 408/429/426), green on the fixed one.
 */
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const mockSignOut = jest.fn(async () => {});
const mockCallAuthed = jest.fn();

jest.mock("@tagly/client", () => ({
  callAuthed: (...args: unknown[]) => mockCallAuthed(...args),
}));
jest.mock("@tagly/sdk/v2/customerApp", () => ({
  getMe: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("@/contexts/session/SessionContext", () => ({
  useSession: () => ({ signOut: mockSignOut }),
}));

// Import AFTER the mocks so the module under test binds to them.
import { CustomerProvider, useCustomer } from "../Customer";

/** Renders the real provider and hands back its `reloadCustomer`. */
function mountReload(): {
  reload: () => Promise<unknown>;
  renderer: ReactTestRenderer;
} {
  let reload: (() => Promise<unknown>) | undefined;
  const Grab = () => {
    reload = useCustomer().reloadCustomer;
    return null;
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <CustomerProvider>
        <Grab />
      </CustomerProvider>
    );
  });
  if (!reload) throw new Error("reloadCustomer not captured");
  return { reload, renderer };
}

const failure = (status: number, code?: number) => ({
  ok: false as const,
  status,
  error: code ? { error: { code, message: "x" } } : undefined,
});

afterEach(() => {
  jest.clearAllMocks();
});

describe.each([
  ["408 SDK timeout", failure(408, 30)],
  ["429 rate limit", failure(429)],
  ["426 forced update", failure(426, 211)],
  ["404 without the stale-session code", failure(404, 1234)],
  ["401 (already handled inside callAuthed)", failure(401)],
])("keeps the session on %s", (_label, result) => {
  it("does not sign out and returns null", async () => {
    mockCallAuthed.mockResolvedValue(result);
    const { reload, renderer } = mountReload();
    let out: unknown;
    await act(async () => {
      out = await reload();
    });
    expect(out).toBeNull();
    expect(mockSignOut).not.toHaveBeenCalled();
    renderer.unmount();
  });
});

it("signs out on 404 + 4043 (account row gone under a valid JWT)", async () => {
  mockCallAuthed.mockResolvedValue(failure(404, 4043));
  const { reload, renderer } = mountReload();
  await act(async () => {
    await reload();
  });
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  renderer.unmount();
});

it("stores and returns the customer on success", async () => {
  const customer = { uid: "c-test", status: "ACTIVE" };
  mockCallAuthed.mockResolvedValue({
    ok: true,
    status: 200,
    data: { customer },
  });
  const { reload, renderer } = mountReload();
  let out: unknown;
  await act(async () => {
    out = await reload();
  });
  expect(out).toBe(customer);
  expect(mockSignOut).not.toHaveBeenCalled();
  renderer.unmount();
});
