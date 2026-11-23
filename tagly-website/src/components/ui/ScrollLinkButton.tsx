"use client";

import { Button } from "@/components/ui/Button";

type ScrollLinkButtonProps = {
  label: string;
  sublabel?: string;
  targetId: string;
  size?: "small" | "large" | "xl";
  type?: "primary" | "secondary";
};

export function ScrollLinkButton({
  label,
  sublabel,
  targetId,
  size = "large",
  type = "primary",
}: ScrollLinkButtonProps) {
  const handleClick = () => {
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Button
      type={type}
      size={size}
      label={label}
      sublabel={sublabel}
      onClick={handleClick}
    />
  );
}
