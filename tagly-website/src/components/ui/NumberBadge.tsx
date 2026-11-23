// The soft-blue circle that marks a numbered point on the homepage. The numeral
// is decorative: ordered lists carry the sequence semantically, and the step
// headings it sits beside read fine on their own.
export function NumberBadge({ value }: { value: number }) {
  return (
    <span
      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-max bg-accent text-style-small-body-bold text-on-accent"
      aria-hidden="true"
    >
      {value}
    </span>
  );
}
