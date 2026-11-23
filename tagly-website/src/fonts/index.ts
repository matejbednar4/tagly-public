import localFont from "next/font/local";

// Self-hosted brand fonts. Only the weights the design system allows are
// shipped: Playfair at 600/700 (it is never used below semibold), Stack Sans at
// 400/500 (it is never used above medium).

export const playfair = localFont({
  src: [
    {
      path: "./playfair/Playfair_144pt-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./playfair/Playfair_144pt-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-heading",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const stackSans = localFont({
  src: [
    {
      path: "./stack-sans/StackSansText-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./stack-sans/StackSansText-Medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
});
