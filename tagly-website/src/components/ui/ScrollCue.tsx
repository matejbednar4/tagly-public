"use client";

import { ChevronDown } from "lucide-react";

/**
 * The bouncing chevron pinned at the bottom of the full-viewport desktop
 * hero: without it, a hero that exactly fills the fold gives no hint that
 * the page continues (the next section's heading used to peek above the
 * fold and can't anymore). Clicking scrolls to the target section, same as
 * the navbar's section links.
 */
export function ScrollCue({
  targetId,
  label,
  className = "",
}: {
  targetId: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" })
      }
      aria-label={label}
      // h-11/w-11 = the 44px minimum tap target.
      className={`h-11 w-11 cursor-pointer items-center justify-center text-ink transition-opacity duration-100 ease-out hover:opacity-70 active:opacity-50 ${className}`}
    >
      <ChevronDown
        size={28}
        strokeWidth={1.75}
        aria-hidden
        className="animate-bounce"
      />
    </button>
  );
}
