/**
 * E042 drive: a FAILED shelf load must never be recorded as a successful empty
 * one. Asserts the fixed contract on the real DiscoverScreen:
 *
 *  1. a failure leaves the fetch key un-burned, so re-focusing the tab retries
 *     (the old shape committed the key and pinned "No businesses here yet"
 *     for the whole session — running this suite against the old file is the
 *     red negative control: it fails cases 2 and 3);
 *  2. pull-to-refresh exists and re-runs every shelf;
 *  3. a SUCCESSFUL load does burn the key — re-focus after success must NOT
 *     refetch (guards against over-fetching in the other direction).
 *
 * Verification scratch for the v2-review fix session (E042).
 */
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ScrollView } from "react-native";

const mockCallAuthed = jest.fn();
let mockFocused = true;

jest.mock("@tagly/client", () => {
  const { View } = jest.requireActual("react-native");
  const Null = () => null;
  const theme = {
    color: {
      background: "#fff",
      surface: "#fff",
      text: { primary: "#000", secondary: "#333", tertiary: "#666" },
    },
    text: { title: {}, body: {}, bodyMedium: {}, caption: {} },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "3xl": 48 },
    layout: { screenPadding: 16 },
  };
  return {
    callAuthed: (...args: unknown[]) => mockCallAuthed(...args),
    useTheme: () => ({ theme }),
    useCooldown: () => ({ active: false, secondsLeft: 0, start: jest.fn() }),
    useCurrentLocation: () => ({
      currentLocation: { latitude: 27.9506, longitude: -82.4572 },
      permissionStatus: "granted",
    }),
    useNavBottomPadding: () => 0,
    businessPreviewHeight: () => 200,
    ZoomOnFocus: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BusinessPreview: Null,
    CustomButton: Null,
    CustomTextInput: Null,
    HorizontalSnapList: Null,
    LocationPermissionNotice: Null,
    NoticeStack: Null,
    RewardEstimatePendingNotice: Null,
    SectionHeader: Null,
    TopMenu: Null,
  };
});
jest.mock("@tagly/sdk/v2/customerApp", () => ({
  getBusinessesFromSearch: jest.fn(),
  getMostPayingBusinesses: jest.fn(),
  getNearestBusinesses: jest.fn(),
  getRecommendedBusinesses: jest.fn(),
}));
// Stable identity — the real expo-router router is referentially stable, and
// it sits in the fetch effects' dep arrays.
const stableRouter = {};
jest.mock("expo-router", () => ({ useRouter: () => stableRouter }));
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockFocused,
  useScrollToTop: () => {},
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
jest.mock("@/contexts/Customer", () => ({
  useCustomer: () => ({
    customer: {
      estimatedStoryViews: 100,
      instagram: { hasSnapshot: true },
    },
  }),
}));

import DiscoverScreen from "../index";

const flush = async (renderer: ReactTestRenderer) => {
  // Settle promise chains + the effect cascades they trigger.
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      renderer.update(<DiscoverScreen />);
    });
  }
};

const setFocused = async (renderer: ReactTestRenderer, focused: boolean) => {
  mockFocused = focused;
  await flush(renderer);
};

it("failed loads stay retriable; successful loads don't refetch", async () => {
  mockFocused = true;
  mockCallAuthed.mockResolvedValue({ ok: false, status: 500 });

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<DiscoverScreen />);
  });
  await flush(renderer);

  // Initial visit: all three browse shelves fetched (and failed).
  expect(mockCallAuthed).toHaveBeenCalledTimes(3);

  // 1) Re-focus after FAILURE retries — the old shape had burned the keys
  //    here and made this a no-op for the rest of the session.
  await setFocused(renderer, false);
  await setFocused(renderer, true);
  expect(mockCallAuthed).toHaveBeenCalledTimes(6);

  // 2) Pull-to-refresh exists (the old shape had none) and re-runs the shelves.
  const scroll = renderer.root.findByType(ScrollView);
  const refreshControl = scroll.props.refreshControl;
  expect(refreshControl).toBeDefined();
  mockCallAuthed.mockResolvedValue({
    ok: true,
    status: 200,
    data: { businesses: [{ uid: "b-x1" }] },
  });
  await act(async () => {
    refreshControl.props.onRefresh();
  });
  await flush(renderer);
  expect(mockCallAuthed).toHaveBeenCalledTimes(9);

  // 3) Re-focus after SUCCESS must NOT refetch (key burned by a real answer).
  await setFocused(renderer, false);
  await setFocused(renderer, true);
  expect(mockCallAuthed).toHaveBeenCalledTimes(9);

  await act(async () => {
    renderer.unmount();
  });
});
