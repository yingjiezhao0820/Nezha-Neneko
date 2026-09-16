import { BackIcon } from "@/components/Icon"
import ServerFlag from "@/components/ServerFlag"
import { ServerDetailLoading } from "@/components/loading/ServerDetailLoading"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { formatBytes } from "@/lib/format"
import { cn, formatNezhaInfo } from "@/lib/utils"
import { ReactNode, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

function formatUptime(seconds: number, daysLabel: string, hoursLabel: string) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return days > 0 ? `${days} ${daysLabel} ${hours} ${hoursLabel}` : `${Math.floor(seconds / 3600)} ${hoursLabel}`
}

function formatSpeed(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(2)} G/s`
  if (value >= 1) return `${value.toFixed(2)} M/s`
  return `${(value * 1024).toFixed(0)} K/s`
}

function DetailItem({ label, children, wide = false }: { label: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2 lg:col-span-3")}>
      <p className="text-[11px] leading-none text-white/55">{label}</p>
      <div className="mt-1 truncate text-xs font-medium leading-5 text-white">{children}</div>
    </div>
  )
}

function LiveMetric({ label, value, detail }: { label: ReactNode; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="min-w-0 border-r border-white/10 px-3 py-3 last:border-r-0">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-white/60">{label}</span>
        <strong className="whitespace-nowrap text-sm font-semibold tabular-nums text-white">{value}</strong>
      </div>
      <div className="mt-1 truncate text-[10px] text-white/55">{detail}</div>
    </div>
  )
}

export default function ServerDetailOverview({ server_id }: { server_id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lastMessage, connected } = useWebSocketContext()
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    setHasHistory(sessionStorage.getItem("fromMainPage") === "true")
  }, [])

  if (!connected && !lastMessage) return <ServerDetailLoading />

  const server = lastMessage?.servers.find((item) => item.id === Number(server_id))
  if (!lastMessage || !server) return <ServerDetailLoading />

  const info = formatNezhaInfo(lastMessage.now, server)
  const goBack = () => {
    if (hasHistory) navigate(-1)
    else navigate("/")
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-neutral-900/45 px-5 py-4 shadow-none backdrop-blur-md sm:px-6">
        <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-left">
          <BackIcon />
          <h1 className="max-w-[70vw] truncate text-xl font-semibold tracking-tight text-white">{info.name}</h1>
          <span className="ml-2 text-base text-white/45">·</span>
        </button>

        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          <DetailItem label={t("serverDetail.status")}>
            <span
              className={cn(
                "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white",
                info.online ? "bg-emerald-600" : "bg-red-600",
              )}
            >
              {info.online ? t("serverDetail.online") : t("serverDetail.offline")}
            </span>
          </DetailItem>
          <DetailItem label={t("serverDetail.uptime")}>
            {formatUptime(info.uptime, t("serverDetail.days"), t("serverDetail.hours"))}
          </DetailItem>
          <DetailItem label={t("serverDetail.arch")}>{info.arch || t("serverDetail.unknown")}</DetailItem>
          <DetailItem label={t("serverDetail.mem")}>{info.mem_total ? formatBytes(info.mem_total) : t("serverDetail.unknown")}</DetailItem>
          <DetailItem label={t("serverDetail.disk")}>{info.disk_total ? formatBytes(info.disk_total) : t("serverDetail.unknown")}</DetailItem>
          <DetailItem label={t("serverDetail.region")}>
            <span className="inline-flex items-center gap-1.5">
              {info.country_code?.toUpperCase() || t("serverDetail.unknown")}
              {info.country_code ? <ServerFlag country_code={info.country_code} /> : null}
            </span>
          </DetailItem>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-5">
          <DetailItem label={t("serverDetail.system")} wide>
            {[info.platform, info.platform_version].filter(Boolean).join(" · ") || t("serverDetail.unknown")}
          </DetailItem>
          <div className="min-w-0 sm:col-span-2">
            <p className="text-[11px] leading-none text-white/55">CPU</p>
            <p className="mt-1 truncate text-xs font-medium leading-5 text-white">
              {info.cpu_info.filter(Boolean).join(", ") || t("serverDetail.unknown")}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
          <DetailItem label="Load">
            {info.load_1} / {info.load_5} / {info.load_15}
          </DetailItem>
          <DetailItem label={t("serverDetail.upload")}>{formatBytes(info.net_out_transfer)}</DetailItem>
          <DetailItem label={t("serverDetail.download")}>{formatBytes(info.net_in_transfer)}</DetailItem>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-lg border border-white/10 bg-neutral-900/45 backdrop-blur-md grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <LiveMetric label="CPU" value={`${info.cpu.toFixed(1)}%`} detail={`Load ${info.load_1}`} />
        <LiveMetric
          label={t("serverDetail.mem")}
          value={`${info.mem.toFixed(1)}%`}
          detail={`${formatBytes(server.state.mem_used)} / ${formatBytes(info.mem_total)}`}
        />
        <LiveMetric
          label={t("serverDetail.disk")}
          value={`${info.disk.toFixed(1)}%`}
          detail={`${formatBytes(server.state.disk_used)} / ${formatBytes(info.disk_total)}`}
        />
        <LiveMetric label={t("serverDetailChart.process")} value={info.process} detail="运行中进程" />
        <LiveMetric label="实时流量" value={`↑ ${formatSpeed(info.up)}`} detail={`↓ ${formatSpeed(info.down)}`} />
        <LiveMetric label="连接" value={`TCP ${info.tcp}`} detail={`UDP ${info.udp}`} />
      </section>
    </div>
  )
}
