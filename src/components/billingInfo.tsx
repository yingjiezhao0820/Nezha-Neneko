import { PublicNoteData, cn, formatBillingAmount, formatBillingCycle, getDaysBetweenDatesWithAutoRenewal } from "@/lib/utils"
import { useTranslation } from "react-i18next"

import RemainPercentBar from "./RemainPercentBar"

export default function BillingInfo({ parsedData }: { parsedData: PublicNoteData }) {
  const { t, i18n } = useTranslation()
  if (!parsedData || !parsedData.billingDataMod) {
    return null
  }

  const billingData = parsedData.billingDataMod
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
      <div className={cn("text-[10px] text-muted-foreground")}>
        {t("billingInfo.remaining")}: {isNeverExpire ? t("billingInfo.indefinite") : daysLeftObject.days + " " + t("billingInfo.days")}
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
