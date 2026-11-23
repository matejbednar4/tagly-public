"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Trans } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18n/client";
import { defaultLng } from "@/lib/i18n/settings";

type FormState = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const params = useParams();
  const lng = (params?.lng as string) || defaultLng;
  const { t } = useTranslation(lng, "contact-form");

  const [formState, setFormState] = useState<FormState>("idle");
  // Controlled ONLY to drive the preferred-contact reveal below — asking how
  // to reach someone only makes sense once there is more than one way.
  const [phone, setPhone] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      businessName: formData.get("businessName"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
      preferredContact: formData.get("preferredContact") || undefined,
      message: formData.get("message") || undefined,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to send");
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "form_submission_success",
        form_id: "contact_form",
      });
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

      <label
        className="mt-(--spacing-element-gap) text-style-body-bold text-text"
        htmlFor="businessName"
      >
        {t("form.businessName.label")} <span className="text-danger">*</span>
      </label>
      <input
        id="businessName"
        name="businessName"
        type="text"
        required
        placeholder={t("form.businessName.placeholder")}
        className="mt-(--spacing-tight-gap) rounded-lg border border-border-strong bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-body text-text placeholder:text-text-tertiary outline-none focus:border-ink"
      />

      <label
        className="mt-(--spacing-element-gap) text-style-body-bold text-text"
        htmlFor="email"
      >
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

      <label
        className="mt-(--spacing-element-gap) text-style-body-bold text-text"
        htmlFor="phone"
      >
        {t("form.phone.label")}{" "}
        <span className="text-style-small-body text-text-tertiary">
          ({t("form.optional")})
        </span>
      </label>
      <input
        id="phone"
        name="phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t("form.phone.placeholder")}
        className="mt-(--spacing-tight-gap) rounded-lg border border-border-strong bg-surface px-(--spacing-card-padding) py-(--spacing-tight-gap) text-style-body text-text placeholder:text-text-tertiary outline-none focus:border-ink"
      />

      {/* Only worth asking once a phone number exists — with email alone
          there is nothing to choose between. Unmounting when the number is
          cleared also drops the radios from the submitted FormData, so a
          stale choice can't ride along without a number. */}
      {phone.trim() !== "" && (
        <fieldset className="mt-(--spacing-element-gap)">
          <legend className="text-style-body-bold text-text">
            {t("form.preferredContact.label")}{" "}
            <span className="text-danger">*</span>
          </legend>
          <div className="mt-(--spacing-tight-gap) flex flex-wrap">
            {[
              { value: "email", label: t("form.preferredContact.options.email") },
              { value: "phone", label: t("form.preferredContact.options.phone") },
              { value: "either", label: t("form.preferredContact.options.either") },
            ].map((option) => (
              <label
                key={option.value}
                className="mr-(--spacing-element-gap) flex items-center text-style-body text-text cursor-pointer"
              >
                <input
                  type="radio"
                  name="preferredContact"
                  value={option.value}
                  required
                  className="peer sr-only"
                />
                <span className="mr-(--spacing-tight-gap) inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong peer-checked:border-ink peer-checked:bg-ink after:block after:h-1.5 after:w-1.5 after:rounded-full after:bg-surface after:opacity-0 peer-checked:after:opacity-100" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label
        className="mt-(--spacing-element-gap) text-style-body-bold text-text"
        htmlFor="message"
      >
        {t("form.message.label")}{" "}
        <span className="text-style-small-body text-text-tertiary">
          ({t("form.optional")})
        </span>
      </label>
      <textarea
        id="message"
        name="message"
        rows={4}
        placeholder={t("form.message.placeholder")}
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

      {formState === "error" && (
        <p className="mt-(--spacing-card-padding) text-style-small-body text-center text-danger">
          <Trans
            t={t}
            i18nKey="form.error"
            components={{
              email: <a href="mailto:sales@taglyapp.com" className="underline" />,
            }}
          />
        </p>
      )}
    </form>
  );
}
