import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type DrawerContextType = {
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  /**
   * Y at which the drawer starts — the top bar's measured height, so the drawer
   * (and its backdrop) sit **below** the top menu, leaving it visible/tappable.
   * `TopMenu` reports this via `onLayout`; `0` when there's no top bar.
   */
  topOffset: number;
  setTopOffset: (height: number) => void;
};

const DrawerContext = createContext<DrawerContextType>({
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  topOffset: 0,
  setTopOffset: () => {},
});

/**
 * Shared side-drawer state. Mount `DrawerProvider` once in each app's authed
 * shell; the top bar's menu button calls `openDrawer`, `TopMenu` reports its
 * height into `topOffset`, and `SideDrawer` renders the app's content below it.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [topOffset, setTopOffset] = useState(0);
  const value = useMemo<DrawerContextType>(
    () => ({
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      toggleDrawer: () => setDrawerOpen((prev) => !prev),
      topOffset,
      setTopOffset,
    }),
    [drawerOpen, topOffset]
  );
  return (
    <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
  );
}

export const useDrawer = () => useContext(DrawerContext);
