"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Trans } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { PressableText } from "@/components/ui/PressableText";
import { useConsent } from "@/components/layout/ConsentProvider";
import { useTranslation } from "@/lib/i18n/client";
import { defaultLng } from "@/lib/i18n/settings";

export function CookieBar() {
  const params = useParams();
  const lng = (params?.lng as string) || defaultLng;
  const { t } = useTranslation(lng, ["cookie-bar", "common"]);
  const { consent, ready, setConsent } = useConsent();

  const visible = ready && consent === null;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className={`fixed bottom-0 left-0 right-0 z-50 bg-background shadow-pinned transition-transform duration-300 ease-out ${
        entered ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-(--spacing-page-max-width) flex-col gap-(--spacing-element-gap) px-(--spacing-page-horizontal-padding) py-(--spacing-element-gap) desktop:flex-row desktop:items-center desktop:justify-between">
        <div className="flex flex-col gap-(--spacing-tight-gap) desktop:max-w-3xl">
          <p className="text-style-body-bold">{t("title")}</p>
          <p className="text-style-small-body">
            <Trans
              t={t}
              i18nKey="description"
              components={{ link: <PressableText href="/privacy-policy" /> }}
            />
          </p>
        </div>
        <div className="flex flex-col gap-(--spacing-tight-gap) desktop:flex-row desktop:items-center">
          <Button
            type="secondary"
            size="small"
            label={t("reject")}
            onClick={() => setConsent("rejected")}
          />
          <Button
            type="primary"
            size="small"
            label={t("accept")}
            onClick={() => setConsent("accepted")}
          />
        </div>
      </div>
    </div>
  );
}
