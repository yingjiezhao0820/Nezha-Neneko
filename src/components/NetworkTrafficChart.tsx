import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { Loader } from "./loading/Loader"

type NetworkTrafficRecord = {
  time: string
  timestamp: number
  net_in: number
  net_out: number
  net_total_down: number
  net_total_up: number
}

type JsonObject = Record<string, unknown>

const KIBIBYTE = 1024
const MEBIBYTE = KIBIBYTE * KIBIBYTE

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null
}

function getRecordList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isJsonObject(payload)) return []
  if (Array.isArray(payload.records)) return payload.records
  if (isJsonObject(payload.data) && Array.isArray(payload.data.records)) return payload.data.records
  return []
}

function normalizeRecord(value: unknown): NetworkTrafficRecord | null {
  if (!isJsonObject(value) || typeof value.time !== "string") return null

  const timestamp = Date.parse(value.time)
  const netIn = Number(value.net_in)
  const netOut = Number(value.net_out)
  if (!Number.isFinite(timestamp) || !Number.isFinite(netIn) || !Number.isFinite(netOut)) return null

  return {
    time: value.time,
    timestamp,
    net_in: Math.max(0, netIn),
    net_out: Math.max(0, netOut),
    net_total_down: Math.max(0, Number(value.net_total_down) || 0),
    net_total_up: Math.max(0, Number(value.net_total_up) || 0),
  }
}

async function fetchNetworkTraffic(uuid: string): Promise<NetworkTrafficRecord[]> {
  const params = new URLSearchParams({ uuid, load_type: "network", hours: "24" })
  // Keep this request on the public REST endpoint so the browser/nginx HTTP gzip path is used.
  const response = await fetch(`/api/records/load?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const payload: unknown = await response.json()
  if (isJsonObject(payload) && typeof payload.status === "string" && payload.status !== "success") {
    throw new Error(typeof payload.message === "string" ? payload.message : "Failed to load network traffic")
  }

  return getRecordList(payload)
    .map(normalizeRecord)
    .filter((record): record is NetworkTrafficRecord => record !== null)
    .sort((a, b) => a.timestamp - b.timestamp)
}

function formatRate(bytesPerSecond: number, compact = false) {
  const value = Number.isFinite(bytesPerSecond) ? Math.max(0, bytesPerSecond) : 0
  if (value >= MEBIBYTE) return `${(value / MEBIBYTE).toFixed(compact ? 1 : 2)} MB/s`
  return `${(value / KIBIBYTE).toFixed(compact ? 0 : 2)} KB/s`
}

function ChartLoading() {
  return (
    <section className="glass-card flex h-[390px] items-center justify-center rounded-2xl border border-white/10 backdrop-blur-md">
      <Loader visible={true} />
    </section>
  )
}

export function NetworkTrafficChart({ server_id }: { server_id: number }) {
  const { t, i18n } = useTranslation()
  const { lastMessage } = useWebSocketContext()
  const server = lastMessage?.servers.find((item) => item.id === server_id)
  const uuid = server?.uuid || ""
  const { data, error } = useQuery({
    queryKey: ["network-traffic", uuid, 24],
    queryFn: () => fetchNetworkTraffic(uuid),
    enabled: Boolean(uuid),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  })

  const peaks = useMemo(
    () => ({
      download: Math.max(0, ...(data?.map((record) => record.net_in) || [])),
      upload: Math.max(0, ...(data?.map((record) => record.net_out) || [])),
    }),
    [data],
  )
  const chartConfig = {
    net_in: {
      label: t("networkTraffic.download"),
      color: "hsl(var(--chart-2))",
    },
    net_out: {
      label: t("networkTraffic.upload"),
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig
  const locale = i18n.resolvedLanguage || i18n.language

  if (!server) return <ChartLoading />

  if (!uuid) {
    return (
      <section className="glass-card flex min-h-40 items-center justify-center rounded-2xl border border-white/10 backdrop-blur-md">
        <p className="text-sm font-medium text-white/60">{t("networkTraffic.noData")}</p>
      </section>
    )
  }

  if (!data && !error) return <ChartLoading />

  if (error || !data || data.length === 0) {
    return (
      <section className="glass-card flex min-h-40 items-center justify-center rounded-2xl border border-white/10 backdrop-blur-md">
        <p className="text-sm font-medium text-white/60">{t(error ? "networkTraffic.loadError" : "networkTraffic.noData")}</p>
      </section>
    )
  }

  return (
    <section className="glass-card overflow-hidden rounded-2xl border border-white/10 shadow-none backdrop-blur-md">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-white">{t("networkTraffic.title")}</h2>
          <p className="mt-0.5 text-[11px] text-white/45">{t("networkTraffic.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
            <span className="size-1.5 rounded-full bg-sky-400" />
            {t("networkTraffic.downloadPeak")} <strong className="tabular-nums text-white">{formatRate(peaks.download)}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {t("networkTraffic.uploadPeak")} <strong className="tabular-nums text-white">{formatRate(peaks.upload)}</strong>
          </span>
        </div>
      </div>

      <div className="bg-black/5 px-2 pb-4 pt-5 sm:px-5">
        <ChartContainer config={chartConfig} className="aspect-auto h-[285px] w-full">
          <LineChart accessibilityLayer data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="timestamp"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={70}
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              tickFormatter={(value) =>
                new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(Number(value)))
              }
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={68}
              domain={[0, "auto"]}
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              tickFormatter={(value) => formatRate(Number(value), true)}
            />
            <ChartTooltip
              isAnimationActive={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  alwaysShowLabel
                  labelFormatter={(_, payload) => {
                    const timestamp = Number(payload[0]?.payload?.timestamp)
                    return Number.isFinite(timestamp)
                      ? new Intl.DateTimeFormat(locale, {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(new Date(timestamp))
                      : ""
                  }}
                  formatter={(value, name) => (
                    <div className="flex min-w-36 items-center justify-between gap-4 text-xs">
                      <span className="text-muted-foreground">{chartConfig[String(name) as keyof typeof chartConfig]?.label || String(name)}</span>
                      <span className="font-medium tabular-nums">{formatRate(Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent className="text-white/70" />} />
            <Line
              dataKey="net_in"
              name="net_in"
              type="linear"
              stroke="var(--color-net_in)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="net_out"
              name="net_out"
              type="linear"
              stroke="var(--color-net_out)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  )
}
