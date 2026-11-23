import React from "react";
import { ThemeProvider, CustomAlertProvider } from "@tagly/client";

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
