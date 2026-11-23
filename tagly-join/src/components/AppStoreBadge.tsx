import { Button } from "@/components/ui/Button";

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v9M4 7l4 4 4-4M2 13h12" />
  </svg>
);

type Props = {
  href: string;
  label?: string;
  className?: string;
};

export function AppStoreBadge({ href, label = "Get Tagly on the App Store", className = "" }: Props) {
  return (
    <Button
      type="primary"
      size="large"
      label={label}
      href={href}
      icon={<DownloadIcon />}
      iconRight
      className={className}
    />
  );
}
