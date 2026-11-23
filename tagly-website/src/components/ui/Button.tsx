"use client";

import { type ReactNode } from "react";
import { LocalizedLink } from "@/components/ui/LocalizedLink";

type ButtonProps = {
  type: "primary" | "secondary";
  size: "small" | "large" | "xl";
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  type,
  size,
  label,
  sublabel,
  href,
  onClick,
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  className = "",
}: ButtonProps) {
  const isPrimary = type === "primary";

  // Every size shares one label style: the heading font is never used in a
  // button, so `xl` gets its presence from padding rather than from type size.
  const baseStyles = `${fullWidth ? "flex w-full" : "inline-flex"} items-center justify-center rounded-sm text-style-body-bold transition-all duration-100 ease-out`;

  const sizeStyles =
    size === "small"
      ? "py-(--spacing-tight-gap) px-(--spacing-card-padding)"
      : size === "xl"
        ? "py-(--spacing-element-gap) px-(--spacing-element-gap)"
        : "py-(--spacing-card-padding) px-(--spacing-card-padding)";

  const typeStyles = isPrimary
    ? "bg-ink text-on-ink border border-transparent"
    : "bg-transparent text-ink border border-ink";

  const interactiveStyles = disabled
    ? "opacity-50 cursor-not-allowed"
    : "hover:opacity-90 hover:-translate-y-px active:opacity-80 active:translate-y-0 cursor-pointer";

  const classes = `${baseStyles} ${sizeStyles} ${typeStyles} ${interactiveStyles} ${className}`;

  const content = (
    <>
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-max border-2 border-current border-t-transparent" />
      ) : (
        <>
          {icon && <span className="mr-(--spacing-tight-gap)">{icon}</span>}
          {sublabel ? (
            <span className="flex flex-col items-start desktop:items-center">
              <span>{label}</span>
              <span className="text-style-small-body opacity-90 desktop:items-center">
                {sublabel}
              </span>
            </span>
          ) : (
            label
          )}
        </>
      )}
    </>
  );

  if (href && !disabled) {
    const isExternal = href.startsWith("http");

    if (isExternal) {
      return (
        <a
          href={href}
          className={classes}
          target="_blank"
          rel="noopener noreferrer"
        >
          {content}
        </a>
      );
    }

    return (
      <LocalizedLink href={href} className={classes}>
        {content}
      </LocalizedLink>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={classes}
    >
      {content}
    </button>
  );
}
