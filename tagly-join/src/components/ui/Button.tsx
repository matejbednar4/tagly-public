import Link from "next/link";
import { type ReactNode } from "react";

/**
 * Web twin of the app's CustomButton tiers (tagly-shared/client CLAUDE.md):
 * primary = ink fill with butter label (the one main action), secondary = white
 * surface that recedes. Buttons own their edges/elevation — radius 4, no
 * hand-rolled shadows elsewhere.
 */
type ButtonProps = {
  type: "primary" | "secondary";
  size: "small" | "large";
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  type,
  size,
  label,
  href,
  onClick,
  disabled = false,
  loading = false,
  icon,
  iconRight = false,
  fullWidth = false,
  className = "",
}: ButtonProps) {
  const isPrimary = type === "primary";

  const baseStyles = `${fullWidth ? "flex w-full" : "inline-flex shrink-0"} items-center justify-center whitespace-nowrap rounded-sm text-style-body-bold transition-all duration-100 ease-out`;

  const sizeStyles =
    size === "small"
      ? "py-(--spacing-tight-gap) px-(--spacing-card-padding)"
      : "py-3 px-(--spacing-element-gap)";

  const typeStyles = isPrimary
    ? "bg-ink text-on-ink"
    : "bg-surface text-ink border border-border-subtle";

  const interactiveStyles = disabled
    ? "opacity-50 cursor-not-allowed"
    : "hover:opacity-90 active:opacity-80 active:scale-[0.99] cursor-pointer";

  const classes = `${baseStyles} ${sizeStyles} ${typeStyles} ${interactiveStyles} ${className}`;

  const content = (
    <>
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-max border-2 border-current border-t-transparent" />
      ) : (
        <>
          {icon && !iconRight && (
            <span className="mr-(--spacing-tight-gap)">{icon}</span>
          )}
          {label}
          {icon && iconRight && (
            <span className="ml-(--spacing-tight-gap)">{icon}</span>
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
      <Link href={href} className={classes}>
        {content}
      </Link>
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
