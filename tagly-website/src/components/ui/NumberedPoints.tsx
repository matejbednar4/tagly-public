import { NumberBadge } from "@/components/ui/NumberBadge";

// A stacked list of short points, each marked with a NumberBadge.
export function NumberedPoints({ items }: { items: string[] }) {
  return (
    <ol className="mx-auto max-w-160">
      {items.map((text, index) => (
        <li
          key={index}
          className="flex items-start mt-(--spacing-element-gap) first:mt-0"
        >
          <NumberBadge value={index + 1} />
          <p className="ml-(--spacing-element-gap) text-style-body text-text">
            {text}
          </p>
        </li>
      ))}
    </ol>
  );
}
