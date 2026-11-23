"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Trans } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n/client";
import { defaultLng } from "@/lib/i18n/settings";
import {
  CONTACT_CATEGORIES,
  CONTACT_INBOXES,
  type ContactCategory,
} from "@/lib/contact-inboxes";

type FormState = "idle" | "submitting" | "success" | "error";

// Stable values submitted to the API; display labels come from the translation.
const reasonValues = [
  "In-app problem",
  "Account issue",
  "Payment or billing",
  "Feature request",
  "Other",
];

// The /contact page's dynamic form: the visitor picks a category (support /
// feedback / something else), the fields adjust (the reason select is
// support-only, the message label follows the category), and the shown direct
// email matches where /api/support will deliver (see CONTACT_INBOXES).
export function ContactRequestForm() {
  const params = useParams();
  const lng = (params?.lng as string) || defaultLng;
  const { t } = useTranslation(lng, "contact");

  const [category, setCategory] = useState<ContactCategory>("support");
  const [formState, setFormState] = useState<FormState>("idle");
  const reasonLabels = t("form.reason.options", { returnObjects: true }) as string[];
  const inbox = CONTACT_INBOXES[category];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");

    const formData = new FormData(e.currentTarget);
    const data = {
      category,
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
      // The reason select only exists in the support layout.
      ...(category === "support" ? { reason: formData.get("reason") } : {}),
    };

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to send");
      setFormState("success");
    } catch {
      setFormState("error");
    }
  }

  if (formState === "success") {
    return (
      <div className="card p-(--spacing-block-gap) text-center">
        <h3 className="text-style-h3 text-text">{t("form.success.title")}</h3>
        <p className="mt-(--spacing-element-gap) text-style-body text-text-secondary">
          {t("form.success.description")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <span className="text-style-body-bold text-text" id="contact-category-label">
        {t("form.category.label")}
      </span>
      <div
        role="group"
        aria-labelledby="contact-category-label"
        className="mt-(--spacing-tight-gap) flex flex-wrap"
      >
        {CONTACT_CATEGORIES.map((value) => {
          const selected = value === category;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(value)}
              className={`mr-(--spacing-tight-gap) mt-(--spacing-tight-gap) cursor-pointer rounded-max px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-small-body-bold transition-colors ${
                selected
                  ? "bg-ink text-on-ink"
                  : "bg-surface text-text shadow-chip hover:text-ink"
              }`}
            >
              {t(`form.category.options.${value}`)}
            </button>
          );
        })}
      </div>
      <div className="mt-(--spacing-element-gap) flex flex-col sm:flex-row">
        <div className="flex flex-1 flex-col">
          <label className="text-style-body-bold text-text" htmlFor="name">
            {t("form.name.label")} <span className="text-danger">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder={t("form.name.placeholder")}
            className="mt-(--spacing-tight-gap) rounded-lg border border-border-strong bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-body text-text placeholder:text-text-tertiary outline-none focus:border-ink"
          />
        </div>
        <div className="mt-(--spacing-element-gap) sm:mt-0 sm:ml-(--spacing-element-gap) flex flex-1 flex-col">
          <label className="text-style-body-bold text-text" htmlFor="email">
            {t("form.email.label")} <span className="text-danger">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder={t("form.email.placeholder")}
            className="mt-(--spacing-tight-gap) rounded-lg border border-border-strong bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-body text-text placeholder:text-text-tertiary outline-none focus:border-ink"
          />
        </div>
      </div>

      {category === "support" && (
        <>
          <label className="mt-(--spacing-element-gap) text-style-body-bold text-text" htmlFor="reason">
            {t("form.reason.label")} <span className="text-danger">*</span>
          </label>
          <select
            id="reason"
            name="reason"
            required
            defaultValue=""
            className="mt-(--spacing-tight-gap) rounded-lg border border-border-strong bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-body text-text outline-none focus:border-ink"
          >
            <option value="" disabled>
              {t("form.reason.placeholder")}
            </option>
            {reasonValues.map((value, index) => (
              <option key={value} value={value}>
                {reasonLabels[index] ?? value}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="mt-(--spacing-element-gap) text-style-body-bold text-text" htmlFor="message">
        {t(`form.message.${category}.label`)} <span className="text-danger">*</span>
      </label>
      <textarea
        id="message"
        name="message"
        rows={5}
        required
        placeholder={t(`form.message.${category}.placeholder`)}
        className="mt-(--spacing-tight-gap) rounded-lg border border-border-strong bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-body text-text placeholder:text-text-tertiary outline-none focus:border-ink resize-vertical"
      />

      <div className="mt-(--spacing-block-gap)">
        <Button
          type="primary"
          size="large"
          label={formState === "submitting" ? t("form.submitting") : t("form.submit")}
          loading={formState === "submitting"}
          disabled={formState === "submitting"}
          fullWidth
        />
      </div>

      <p className="mt-(--spacing-card-padding) text-style-small-body text-center text-text-secondary">
        <Trans
          t={t}
          i18nKey="form.directEmail"
          values={{ email: inbox }}
          components={{
            mail: <a href={`mailto:${inbox}`} className="text-style-small-body-bold text-text underline" />,
          }}
        />
      </p>

      {formState === "error" && (
        <p className="mt-(--spacing-card-padding) text-style-small-body text-center text-danger">
          <Trans
            t={t}
            i18nKey="form.error"
            values={{ email: inbox }}
            components={{
              mail: <a href={`mailto:${inbox}`} className="underline" />,
            }}
          />
        </p>
      )}
    </form>
  );
}
