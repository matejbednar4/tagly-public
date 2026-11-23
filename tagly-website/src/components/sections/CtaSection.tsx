import { Button } from "@/components/ui/Button";

type CtaAction = {
  label: string;
  href: string;
  sublabel?: string;
};

type CtaSectionProps = {
  heading: string;
  description: string;
  primaryAction: CtaAction;
  secondaryAction?: CtaAction;
};

export function CtaSection({
  heading,
  description,
  primaryAction,
  secondaryAction,
}: CtaSectionProps) {
  return (
    <section className="mx-auto max-w-page-max-width px-(--spacing-page-horizontal-padding) pb-(--spacing-section-gap) desktop:px-(--spacing-page-horizontal-padding-lg)">
      <div className="mx-auto max-w-160 desktop:text-center">
        <h2 className="text-style-h2 text-text">{heading}</h2>
        <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
          {description}
        </p>
        <div className="mt-(--spacing-block-gap) flex flex-row items-center desktop:justify-center">
          <Button
            type="primary"
            size="large"
            label={primaryAction.label}
            sublabel={primaryAction.sublabel}
            href={primaryAction.href}
          />
          {secondaryAction && (
            <div className="ml-(--spacing-card-padding)">
              <Button
                type="secondary"
                size="large"
                label={secondaryAction.label}
                href={secondaryAction.href}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
