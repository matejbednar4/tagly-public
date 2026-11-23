import Link from "next/link";
import { type ReactNode } from "react";

type PressableTextProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

export function PressableText({
  children,
  href,
  onClick,
  disabled = false,
  className = "",
}: PressableTextProps) {
  const baseStyles =
    "relative inline-flex items-center text-style-body-bold text-ink transition-opacity duration-100 ease-out after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100";

  const interactiveStyles = disabled
    ? "opacity-75 cursor-default after:hidden"
    : "cursor-pointer active:opacity-50";

  const classes = `${baseStyles} ${interactiveStyles} ${className}`;

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
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
