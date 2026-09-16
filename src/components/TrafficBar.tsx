import { formatBytes } from "@/lib/format"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface TrafficBarProps {
  used: number
  limit: number
  resetDay?: number
  limitType: string
  compact?: boolean
}

function getMonthlyResetDate(now: Date, day: number): Date {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return new Date(now.getFullYear(), now.getMonth(), Math.min(day, lastDay))
}

function calcResetDays(resetDay?: number): number | null {
  if (!resetDay || resetDay < 1 || resetDay > 31) return null

  const now = new Date()
  let reset = getMonthlyResetDate(now, resetDay)
  if (reset <= now) {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    reset = getMonthlyResetDate(nextMonth, resetDay)
  }

  return Math.ceil((reset.getTime() - now.getTime()) / 86400000)
}

function getColor(percent: number): string {
  return `hsl(${(100 - percent) * 1.4}, 70%, 50%)`
}

export default function TrafficBar({ used, limit, resetDay, limitType, compact = false }: TrafficBarProps) {
  const { t } = useTranslation()
  const [infoIndex, setInfoIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const win = window as unknown as Record<string, unknown>
  const showPercent = win.TrafficBarShowPercent !== false
  const showResetDay = win.TrafficBarShowResetDay !== false
  const showBillingMode = win.TrafficBarShowBillingMode !== false

  const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const percentStr = percent.toFixed(2)
  const usedFormatted = formatBytes(used)
  const limitFormatted = formatBytes(limit)
  const resetDays = calcResetDays(resetDay)
  const limitTypeLabel =
    limitType === "max"
      ? t("trafficBar.typeMax")
      : limitType === "min"
        ? t("trafficBar.typeMin")
        : limitType === "up"
          ? t("trafficBar.typeUp")
          : limitType === "down"
            ? t("trafficBar.typeDown")
            : t("trafficBar.typeSum")

  // 根据设置构建要显示的信息项
  const infoItems: string[] = []
  if (showPercent) infoItems.push(`${percentStr}%`)
  if (showResetDay) infoItems.push(`${t("trafficBar.reset")}: ${resetDays === null ? "N/A" : `${resetDays} ${t("billingInfo.days")}`}`)
  if (showBillingMode) infoItems.push(`${t("trafficBar.billing")}: ${limitTypeLabel}`)

  const shouldCycle = !compact && infoItems.length > 1

  useEffect(() => {
    if (!shouldCycle) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
      return
    }
    timerRef.current = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setInfoIndex((prev) => (prev + 1) % infoItems.length)
        setFading(false)
      }, 500)
    }, 3000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [shouldCycle, infoItems.length])

  if (limit <= 0) return null

  if (compact) {
    return (
      <div className="w-full" title={`${usedFormatted} / ${limitFormatted}`}>
        <div className="flex items-center text-xs font-semibold">{percent.toFixed(1)}%</div>
        <div className="relative h-[3px] w-full">
          <div className="absolute inset-0 rounded-sm bg-white/10" />
          <div
            className="absolute inset-0 rounded-sm transition-all duration-300"
            style={{
              width: `${percentStr}%`,
              backgroundColor: getColor(percent),
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] font-medium text-white">
            {usedFormatted}
          </span>
          <span className="text-[10px] text-white/55">
            / {limitFormatted}
          </span>
        </div>
        {infoItems.length > 0 && (
          shouldCycle ? (
            <div
              className="text-[10px] font-medium text-white/70 transition-opacity duration-500"
              style={{ opacity: fading ? 0 : 1 }}
            >
              {infoItems[infoIndex % infoItems.length]}
            </div>
          ) : (
            <span className="text-[10px] font-medium text-white/70">
              {infoItems[0]}
            </span>
          )
        )}
      </div>
      <div className="relative h-[3px] w-full">
        <div className="absolute inset-0 rounded-sm bg-white/10" />
        <div
          className="absolute inset-0 rounded-sm transition-all duration-300"
          style={{
            width: `${percentStr}%`,
            backgroundColor: getColor(percent),
          }}
        />
      </div>
    </div>
  )
}
