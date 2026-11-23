"use client";

import { type ReactNode } from "react";
import { PressableText } from "@/components/ui/PressableText";

export function ScrollLink({
  targetId,
  children,
}: {
  targetId: string;
  children?: ReactNode;
}) {
  return (
    <PressableText
      onClick={() => {
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      {children}
    </PressableText>
  );
}
