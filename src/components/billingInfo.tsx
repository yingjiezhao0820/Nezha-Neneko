import {
  PublicNoteData,
  calculateRemainingBillingValue,
  cn,
  formatBillingAmount,
  formatBillingCycle,
  getDaysBetweenDatesWithAutoRenewal,
  normalizeBillingCurrency,
  parseBillingAmountNumber,
} from "@/lib/utils"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import RemainPercentBar from "./RemainPercentBar"

export default function BillingInfo({ parsedData }: { parsedData: PublicNoteData }) {
  const { t, i18n } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const [showRemainingValue, setShowRemainingValue] = useState(false)
  const billingData = parsedData?.billingDataMod
  const themeSettings = window as unknown as Record<string, unknown>
  const rotationEnabled = themeSettings.EnableRemainingValueRotation === true
  const configuredInterval = Number(themeSettings.RemainingValueRotationInterval)
  const rotationIntervalMs = (Number.isFinite(configuredInterval) ? Math.min(60, Math.max(2, configuredInterval)) : 5) * 1000
  const billingAmountNumber = billingData ? parseBillingAmountNumber(billingData.amount) : null
  const remainingBilling = billingData && billingAmountNumber !== null ? calculateRemainingBillingValue(billingData, billingAmountNumber) : null
  const normalizedCurrency = normalizeBillingCurrency(billingData?.currency)
  const remainingValueText =
    remainingBilling && billingAmountNumber !== null && !remainingBilling.isExpired && !remainingBilling.isLongTerm && remainingBilling.days !== null
      ? `${t("serverDetail.remainingValue")}: ${formatBillingAmount(
          remainingBilling.value.toFixed(normalizedCurrency === "JPY" ? 0 : 2),
          normalizedCurrency,
        )}`
      : null
  const canRotateRemaining = rotationEnabled && Boolean(remainingValueText)

  useEffect(() => {
    if (!canRotateRemaining) return

    const interval = window.setInterval(() => setShowRemainingValue((current) => !current), rotationIntervalMs)
    return () => window.clearInterval(interval)
  }, [canRotateRemaining, rotationIntervalMs])

  if (!billingData) {
    return null
  }

  const billingAmount = formatBillingAmount(billingData.amount, billingData.currency)
  const billingCycle = formatBillingCycle(billingData.cycle, i18n.resolvedLanguage || i18n.language)
  const billingPrice = billingCycle ? `${billingAmount}/${billingCycle}` : billingAmount
  const billingPriceText = `${t("billingInfo.price")}: ${billingPrice}`

  let isNeverExpire = false
  let daysLeftObject = {
    days: 0,
    cycleLabel: "",
    remainingPercentage: 0,
  }

  if (billingData.endDate) {
    if (billingData.endDate.startsWith("0000-00-00")) {
      isNeverExpire = true
    } else {
      try {
        daysLeftObject = getDaysBetweenDatesWithAutoRenewal(billingData)
      } catch (error) {
        console.error(error)
        return (
          <div className={cn("text-[10px] text-muted-foreground text-red-600")}>
            {t("billingInfo.remaining")}: {t("billingInfo.error")}
          </div>
        )
      }
    }
  }

  return daysLeftObject.days >= 0 ? (
    <>
      {billingData.amount && billingData.amount !== "0" && billingData.amount !== "-1" ? (
        <p className={cn("max-w-full truncate whitespace-nowrap text-[10px] text-muted-foreground")} title={billingPriceText}>
          {billingPriceText}
        </p>
      ) : billingData.amount === "-1" ? (
        <p className={cn("text-[10px] text-green-600 ")}>{t("billingInfo.free")}</p>
      ) : null}
      <div
        className={cn("relative h-[15px] max-w-full overflow-hidden text-[10px] text-muted-foreground")}
        title={
          canRotateRemaining && showRemainingValue && remainingValueText
            ? remainingValueText
            : `${t("billingInfo.remaining")}: ${isNeverExpire ? t("billingInfo.indefinite") : `${daysLeftObject.days} ${t("billingInfo.days")}`}`
        }
      >
        <AnimatePresence initial={false} mode="wait">
          <m.span
            key={canRotateRemaining && showRemainingValue ? "remaining-value" : "remaining-days"}
            className="absolute inset-0 block truncate whitespace-nowrap"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          >
            {canRotateRemaining && showRemainingValue && remainingValueText
              ? remainingValueText
              : `${t("billingInfo.remaining")}: ${isNeverExpire ? t("billingInfo.indefinite") : `${daysLeftObject.days} ${t("billingInfo.days")}`}`}
          </m.span>
        </AnimatePresence>
      </div>
      {!isNeverExpire && <RemainPercentBar className="mt-0.5" value={daysLeftObject.remainingPercentage * 100} />}
    </>
  ) : (
    <>
      {billingData.amount && billingData.amount !== "0" && billingData.amount !== "-1" ? (
        <p className={cn("max-w-full truncate whitespace-nowrap text-[10px] text-muted-foreground")} title={billingPriceText}>
          {billingPriceText}
        </p>
      ) : billingData.amount === "-1" ? (
        <p className={cn("text-[10px] text-green-600 ")}>{t("billingInfo.free")}</p>
      ) : null}
      <p className={cn("text-[10px] text-muted-foreground text-red-600")}>
        {t("billingInfo.expired")}: {daysLeftObject.days * -1} {t("billingInfo.days")}
      </p>
    </>
  )
}
