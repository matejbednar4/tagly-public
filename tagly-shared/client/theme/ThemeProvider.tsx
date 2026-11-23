import React, { createContext, useContext, useMemo, useState } from "react";
import { Theme, ThemeName, themes } from "./theme";

type ThemeContextValue = {
  /** Active design tokens (Cream / Neutral). Text styles live at `theme.text`. */
  theme: Theme;
  /** Which named theme is currently active. */
  themeName: ThemeName;
  /** Switch the active theme at runtime. */
  setThemeName: (name: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: themes.brand,
  themeName: "brand",
  setThemeName: () => {},
});

export function ThemeProvider({
  initialThemeName = "brand",
  children,
}: {
  /** Theme to start on. Switchable later via `setThemeName` from `useTheme()`. */
  initialThemeName?: ThemeName;
  children: React.ReactNode;
}) {
  const [themeName, setThemeName] = useState<ThemeName>(initialThemeName);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: themes[themeName], themeName, setThemeName }),
    [themeName],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
