import { BackIcon } from "@/components/Icon"
import ServerFlag from "@/components/ServerFlag"
import { ServerDetailLoading } from "@/components/loading/ServerDetailLoading"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { formatBytes } from "@/lib/format"
import { cn, formatNezhaInfo } from "@/lib/utils"
import countries from "i18n-iso-countries"
import enLocale from "i18n-iso-countries/langs/en.json"
import { ReactNode, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

countries.registerLocale(enLocale)

function formatUptime(seconds: number, daysLabel: string, hoursLabel: string) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return days > 0 ? `${days} ${daysLabel} ${hours} ${hoursLabel}` : `${Math.floor(seconds / 3600)} ${hoursLabel}`
}

function formatSpeed(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(2)} G/s`
  if (value >= 1) return `${value.toFixed(2)} M/s`
  return `${(value * 1024).toFixed(2)} K/s`
}

function InfoItem({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-xs font-medium text-foreground" title={typeof value === "string" ? value : undefined}>
        {value}
      </div>
    </div>
  )
}

function MetricCell({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="-mr-px -mt-px min-w-0 border-r border-t border-border/70 px-3 py-3 sm:px-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[11px] text-muted-foreground">{label}</p>
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums">{value}</p>
      </div>
      {detail ? <div className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

export default function ServerDetailOverview({ server_id }: { server_id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [hasHistory, setHasHistory] = useState(false)
  const { lastMessage, connected } = useWebSocketContext()

  useEffect(() => {
    setHasHistory(sessionStorage.getItem("fromMainPage") === "true")
  }, [])

  if (!connected && !lastMessage) {
    return <ServerDetailLoading />
  }

  const nezhaWsData = lastMessage
  const server = nezhaWsData?.servers.find((item) => item.id === Number(server_id))

  if (!nezhaWsData || !server) {
    return <ServerDetailLoading />
  }

  const info = formatNezhaInfo(nezhaWsData.now, server)
  const {
    name,
    online,
    uptime,
    version,
    arch,
    mem_total,
    disk_total,
    country_code,
    platform,
    platform_version,
    cpu_info,
    cpu,
    mem,
    disk,
    process,
    up,
    down,
    tcp,
    udp,
    load_1,
    load_5,
    load_15,
    net_out_transfer,
    net_in_transfer,
    last_active_time_string,
    boot_time_string,
  } = info

  const customBackgroundImage = (window.CustomBackgroundImage as string) !== "" ? window.CustomBackgroundImage : undefined
  const countryName = country_code ? countries.getName(country_code.toUpperCase(), "en") : undefined
  const goBack = () => {
    if (hasHistory) navigate(-1)
    else navigate("/")
  }

  return (
    <Card
      className={cn("overflow-hidden rounded-xl border-border/70 shadow-sm", {
        "bg-card/75 backdrop-blur-xl": customBackgroundImage,
      })}
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <button type="button" onClick={goBack} className="group flex min-w-0 items-center gap-1.5 text-left server-name">
            <span className="transition-transform group-hover:-translate-x-0.5">
              <BackIcon />
            </span>
            <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
          </button>
          <div className="flex items-center gap-2">
            {country_code ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="gap-1 rounded-full px-2 py-1 text-[10px] font-medium">
                      <ServerFlag country_code={country_code} />
                      {country_code.toUpperCase()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{countryName}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <Badge
              className={cn("gap-1.5 rounded-full px-2.5 py-1 text-[10px] text-white", online ? "bg-emerald-600" : "bg-red-600")}
            >
              <span className={cn("size-1.5 rounded-full", online ? "bg-emerald-200" : "bg-red-200")} />
              {online ? t("serverDetail.online") : t("serverDetail.offline")}
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <InfoItem label={t("serverDetail.uptime")} value={formatUptime(uptime, t("serverDetail.days"), t("serverDetail.hours"))} />
          <InfoItem label={t("serverDetail.arch")} value={arch || t("serverDetail.unknown")} />
          <InfoItem label={t("serverDetail.mem")} value={mem_total ? formatBytes(mem_total) : t("serverDetail.unknown")} />
          <InfoItem label={t("serverDetail.disk")} value={disk_total ? formatBytes(disk_total) : t("serverDetail.unknown")} />
          <InfoItem label={t("serverDetail.version")} value={version || "Komari"} />
          <InfoItem label={t("serverDetail.region")} value={countryName || country_code?.toUpperCase() || t("serverDetail.unknown")} />
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
          <InfoItem
            label={t("serverDetail.system")}
            value={[platform, platform_version].filter(Boolean).join(" · ") || t("serverDetail.unknown")}
          />
          <InfoItem label="CPU" value={cpu_info.filter(Boolean).join(", ") || t("serverDetail.unknown")} />
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden bg-muted/20 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCell label="CPU" value={`${cpu.toFixed(1)}%`} detail={`Load ${load_1}`} />
        <MetricCell label={t("serverDetail.mem")} value={`${mem.toFixed(1)}%`} detail={`${formatBytes(server.state.mem_used)} / ${formatBytes(mem_total)}`} />
        <MetricCell label={t("serverDetail.disk")} value={`${disk.toFixed(1)}%`} detail={`${formatBytes(server.state.disk_used)} / ${formatBytes(disk_total)}`} />
        <MetricCell label={t("serverDetailChart.process")} value={process} detail={`${t("serverDetail.uptime")} ${formatUptime(uptime, t("serverDetail.days"), t("serverDetail.hours"))}`} />
        <MetricCell label={t("serverDetailChart.upload")} value={`↑ ${formatSpeed(up)}`} detail={`↓ ${formatSpeed(down)}`} />
        <MetricCell label={t("serverDetail.status")} value={`TCP ${tcp}`} detail={`UDP ${udp}`} />
      </div>

      <div className="grid gap-x-5 gap-y-3 border-t border-border/70 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 sm:px-5">
        <InfoItem label={t("serverDetail.upload")} value={formatBytes(net_out_transfer)} />
        <InfoItem label={t("serverDetail.download")} value={formatBytes(net_in_transfer)} />
        <InfoItem label={t("serverDetail.bootTime")} value={boot_time_string || "N/A"} />
        <InfoItem label={t("serverDetail.lastActive")} value={last_active_time_string || "N/A"} />
      </div>

      {server.state.temperatures?.length > 0 ? (
        <div className="border-t border-border/70 px-4 sm:px-5">
          <Accordion type="single" collapsible>
            <AccordionItem value="temperatures" className="border-none">
              <AccordionTrigger className="py-3 text-xs font-normal text-muted-foreground">
                {t("serverDetail.temperature")}
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {server.state.temperatures.map((item) => (
                    <span className="text-xs" key={item.Name}>
                      <strong>{item.Name}</strong>: {item.Temperature.toFixed(2)} °C
                    </span>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : null}

      <span className="sr-only">
        Load {load_1} / {load_5} / {load_15}
      </span>
    </Card>
  )
}
