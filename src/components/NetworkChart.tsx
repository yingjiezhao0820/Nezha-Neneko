"use client"

import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { fetchMonitor } from "@/lib/nezha-api"
import { formatTime } from "@/lib/utils"
import { NezhaMonitor } from "@/types/nezha-api"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import NetworkChartLoading from "./NetworkChartLoading"

type CombinedPoint = {
  created_at: number
  [key: string]: number
}

const CHART_COLORS = [
  "hsl(var(--chart-3))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-9))",
  "hsl(var(--chart-10))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-8))",
]

function combineMonitorData(monitors: NezhaMonitor[]): CombinedPoint[] {
  const points = new Map<number, CombinedPoint>()

  for (const monitor of monitors) {
    monitor.created_at.forEach((createdAt, index) => {
      const point = points.get(createdAt) || { created_at: createdAt }
      point[monitor.monitor_name] = monitor.avg_delay[index] ?? 0
      points.set(createdAt, point)
    })
  }

  return [...points.values()].sort((a, b) => a.created_at - b.created_at)
}

function getLatestDelay(monitor: NezhaMonitor) {
  for (let index = monitor.avg_delay.length - 1; index >= 0; index -= 1) {
    const value = monitor.avg_delay[index]
    if (Number.isFinite(value)) return value
  }
  return 0
}

function getLatestLoss(monitor: NezhaMonitor) {
  const values = monitor.packet_loss || []
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (Number.isFinite(value)) return value
  }
  return 0
}

export function NetworkChart({ server_id, show }: { server_id: number; show: boolean }) {
  const { t } = useTranslation()
  const { data: monitorData } = useQuery({
    queryKey: ["monitor", server_id, 24],
    queryFn: () => fetchMonitor(server_id, 24),
    enabled: show,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  })

  const monitors = monitorData?.data || []
  const chartData = useMemo(() => combineMonitorData(monitors), [monitors])
  const chartConfig = useMemo(
    () =>
      monitors.reduce((config, monitor, index) => {
        config[monitor.monitor_name] = {
          label: monitor.monitor_name,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }
        return config
      }, {} as ChartConfig),
    [monitors],
  )

  if (!monitorData) return <NetworkChartLoading />

  if (!monitorData.success || monitors.length === 0) {
    return (
      <section className="flex min-h-40 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900/45 backdrop-blur-md">
        <p className="text-sm font-medium text-white/60">{t("monitor.noData", "该服务器未配置延迟检测")}</p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/45 shadow-none backdrop-blur-md">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {monitors.map((monitor) => (
          <div className="-mr-px min-w-0 border-b border-r border-white/10 px-4 py-3" key={monitor.monitor_id}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-white/75">{monitor.monitor_name}</span>
              <span className="whitespace-nowrap text-[10px] text-white/45">丢包 {getLatestLoss(monitor).toFixed(2)}%</span>
            </div>
            <p className="mt-1 text-base font-semibold leading-none tabular-nums text-white">{getLatestDelay(monitor).toFixed(2)}ms</p>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 bg-black/5 px-2 pb-4 pt-5 sm:px-5">
        <ChartContainer config={chartConfig} className="aspect-auto h-[285px] w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="created_at"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={70}
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={52}
              domain={[0, "auto"]}
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              tickFormatter={(value) => `${value}ms`}
            />
            <ChartTooltip
              isAnimationActive={false}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(_, payload) => (payload[0]?.payload?.created_at ? formatTime(payload[0].payload.created_at) : "")}
                  formatter={(value, name) => (
                    <div className="flex min-w-32 items-center justify-between gap-4 text-xs">
                      <span className="text-muted-foreground">{String(name)}</span>
                      <span className="font-medium tabular-nums">{Number(value).toFixed(2)}ms</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent className="flex-wrap gap-x-3 gap-y-1 text-white/70" />} />
            {monitors.map((monitor, index) => (
              <Line
                key={monitor.monitor_id}
                dataKey={monitor.monitor_name}
                name={monitor.monitor_name}
                type="linear"
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={1.25}
                dot={false}
                connectNulls={true}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </div>
    </section>
  )
}
