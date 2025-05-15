"use client";
import { useTranslations } from "next-intl";

export default function AlertHistoricError() {
  const t = useTranslations();
  return (
    <div role="alert" tabIndex={-1} className="bg-red-100 text-red-800 text-center p-2 rounded-lg mb-2">
        {t('chat.error_loading_historic')}
    </div>
  )
}