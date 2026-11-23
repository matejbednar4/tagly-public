import React from "react";
import { ThemeProvider, CustomAlertProvider } from "@tagly/client";

/**
 * Bridges the shared design system into the admin app: the (Cream) `ThemeProvider`
 * + the cross-platform `CustomAlertProvider`. Byte-identical to the customer/
 * advertiser bridge — admin consumes the same design system.
 */
export default function TaglyDesignBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <CustomAlertProvider>{children}</CustomAlertProvider>
    </ThemeProvider>
  );
}
