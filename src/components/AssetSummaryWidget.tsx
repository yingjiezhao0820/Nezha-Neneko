import type { SortOrder, SortType } from "@/context/sort-context"
import { useSort } from "@/hooks/use-sort"
import { buildMarkdownTable, copyTextToClipboard } from "@/lib/clipboard"
import { formatBytes } from "@/lib/format"
import { ASSET_COLORS, resolveAssetColor } from "@/lib/theme-colors"
import {
  calcTrafficUsed,
  calculateRemainingBillingValue,
  cn,
  formatBillingAmount,
  formatNezhaInfo,
  normalizeBillingCurrency,
  parseBillingAmountNumber,
  parseBillingCycleDays,
  parsePublicNote,
  resolveThemeBillingCurrency,
} from "@/lib/utils"
import { NezhaServer } from "@/types/nezha-api"
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  CalendarDays,
  Check,
  ChevronsUpDown,
  CircleDollarSign,
  Copy,
  HelpCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

type AssetSummaryWidgetProps = {
  now: number
  servers: NezhaServer[]
}

export const ASSET_SUMMARY_OPEN_EVENT = "nezha:open-asset-summary"
export const ASSET_TRADE_OPEN_EVENT = "nezha:open-asset-trade"

type BillingData = NonNullable<NonNullable<ReturnType<typeof parsePublicNote>>["billingDataMod"]>
type FormattedServer = ReturnType<typeof formatNezhaInfo>
type ExchangeRates = Record<string, number>
type FinanceTab = "fixed" | "metered" | "rates"
type AssetTableSortKey = "expiry" | "remaining" | "monthly"
type AssetTableSortState = { key: AssetTableSortKey; direction: "desc" | "asc" } | null
type TrafficMode = "sum" | "max" | "up" | "down"
type MeteredSettings = {
  trafficMode: TrafficMode
  currency: string
  trafficRate: number
  timeRate: number
  manualHours: number
  oneTimeFee: number
}

type AssetItem = {
  id: number
  name: string
  displayIndex: number
  formatted: FormattedServer
  billing?: BillingData
  sourceAmount: number | null
  sourceCurrency: string
  priceCny: number | null
  monthlyCny: number | null
  remainingCny: number | null
  remainingDays: number | null
  isExpired: boolean
  isFree: boolean
  isUsageBased: boolean
  isLongTerm: boolean
  isFreeTagged: boolean
  sourcePriceText: string
}

const DISPLAY_CURRENCIES = ["CNY", "USD", "HKD", "EUR", "GBP", "JPY"] as const
const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  CNY: 1,
  USD: 0.142536,
  HKD: 1.108377,
  EUR: 0.12102,
  GBP: 0.105581,
  JPY: 22.231552,
}
const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  HKD: "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
}
const TRAFFIC_MODE_LABELS: Record<TrafficMode, string> = {
  sum: "上行 + 下行",
  max: "取较大值",
  up: "仅上行",
  down: "仅下行",
}
const TIB_BYTES = 1024 ** 4
const MAX_METERED_INPUT = 1_000_000_000
const RATE_OVERRIDES_KEY = "asset_card_rate_overrides"

function getStoredRateOverrides(): ExchangeRates {
  try {
    const stored = JSON.parse(localStorage.getItem(RATE_OVERRIDES_KEY) || "{}") as ExchangeRates
    return Object.fromEntries(Object.entries(stored).filter(([, value]) => Number.isFinite(value) && value > 0))
  } catch {
    return {}
  }
}

function getMeteredStorageKey(serverId: number) {
  return `asset_metered_estimate:${serverId}`
}

function getDefaultMeteredSettings(currency: string): MeteredSettings {
  return {
    trafficMode: "sum",
    currency,
    trafficRate: 0,
    timeRate: 0,
    manualHours: 0,
    oneTimeFee: 0,
  }
}

function getStoredMeteredSettings(serverId: number, currency: string): MeteredSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(getMeteredStorageKey(serverId)) || "{}") as Partial<MeteredSettings>
    return {
      trafficMode: stored.trafficMode && stored.trafficMode in TRAFFIC_MODE_LABELS ? stored.trafficMode : "sum",
      currency: DISPLAY_CURRENCIES.includes(stored.currency as (typeof DISPLAY_CURRENCIES)[number]) ? stored.currency! : currency,
      trafficRate: Number.isFinite(stored.trafficRate) ? Math.max(0, Number(stored.trafficRate)) : 0,
      timeRate: Number.isFinite(stored.timeRate) ? Math.max(0, Number(stored.timeRate)) : 0,
      manualHours: Number.isFinite(stored.manualHours) ? Math.max(0, Number(stored.manualHours)) : 0,
      oneTimeFee: Number.isFinite(stored.oneTimeFee) ? Math.max(0, Number(stored.oneTimeFee)) : 0,
    }
  } catch {
    return getDefaultMeteredSettings(currency)
  }
}

function formatEstimateTraffic(tib: number) {
  return tib < 0.001 ? `${(tib * 1024).toFixed(2)} GiB` : `${tib.toFixed(3)} TiB`
}

function formatEstimateHours(hours: number) {
  return hours < 24 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} d`
}

function getInitialCurrency(): string {
  const win = window as unknown as Record<string, unknown>
  const configured = typeof win.AssetCardDefaultCurrency === "string" ? normalizeBillingCurrency(win.AssetCardDefaultCurrency) : ""
  if (DISPLAY_CURRENCIES.includes(configured as (typeof DISPLAY_CURRENCIES)[number])) {
    return configured
  }

  return localStorage.getItem("asset_card_currency") || "CNY"
}

function normalizeAssetCurrency(currency?: string): string {
  return normalizeBillingCurrency(currency)
}

function formatMoney(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) {
    return "--"
  }

  const digits = currency === "JPY" ? 0 : 2
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `
  return `${symbol}${value.toFixed(digits)}`
}

function amountToCny(amount: number, currency: string, rates: ExchangeRates): number | null {
  const sourceCurrency = normalizeAssetCurrency(currency)
  if (!sourceCurrency) {
    return null
  }
  if (sourceCurrency === "CNY") {
    return amount
  }

  const rate = rates[sourceCurrency]
  return rate ? amount / rate : null
}

function cnyToCurrency(amount: number | null, currency: string, rates: ExchangeRates): number | null {
  if (amount === null) {
    return null
  }
  const rate = rates[currency]
  return rate ? amount * rate : null
}

function getSourcePriceText(billing?: BillingData, currency?: string): string {
  if (!billing?.amount) {
    return "未设置"
  }
  // Komari 语义：price === 0 表示未配置/不显示价格；price === -1 表示免费。
  if (billing.amount === "0") {
    return "未设置"
  }
  if (billing.amount === "-1") {
    return "免费"
  }

  const amount = formatBillingAmount(billing.amount, currency || billing.currency)
  return billing.cycle ? `${amount}/${billing.cycle}` : amount
}

function formatEndDate(endDate?: string): string {
  if (!endDate) {
    return "-"
  }
  if (endDate.startsWith("0000-00-00")) {
    return "长期"
  }

  const endMs = Date.parse(endDate)
  return Number.isFinite(endMs) ? new Date(endMs).toLocaleDateString() : "-"
}

function buildAssetItem(now: number, server: NezhaServer, rates: ExchangeRates): AssetItem {
  const formatted = formatNezhaInfo(now, server)
  const parsed = parsePublicNote(formatted.public_note)
  const billing = parsed?.billingDataMod
  const sourceAmount = billing ? parseBillingAmountNumber(billing.amount) : null
  const sourceCurrency = normalizeAssetCurrency(resolveThemeBillingCurrency(server, billing?.currency) || billing?.currency)
  const priceCny = sourceAmount !== null && sourceAmount > 0 ? amountToCny(sourceAmount, sourceCurrency, rates) : sourceAmount === 0 ? 0 : null
  const cycleDays = billing ? parseBillingCycleDays(billing.cycle, billing.startDate, billing.endDate) : null
  const monthlyCny = priceCny !== null && cycleDays ? priceCny / (cycleDays / 30) : null
  const remaining = billing && sourceAmount !== null ? calculateRemainingBillingValue(billing, sourceAmount) : null
  const remainingCny = remaining && sourceCurrency ? amountToCny(remaining.value, sourceCurrency, rates) : null
  const extra = parsed?.planDataMod?.extra || ""

  return {
    id: formatted.id,
    name: formatted.name,
    displayIndex: formatted.display_index || 0,
    formatted,
    billing,
    sourceAmount,
    sourceCurrency,
    priceCny,
    monthlyCny,
    remainingCny,
    remainingDays: remaining?.days ?? null,
    isExpired: remaining?.isExpired || false,
    // Komari 语义：price === -1 才是真正的"免费"，price === 0 表示未配置价格（不计入资产汇总也不算"免费白嫖"）。
    // 两者都不应贡献资产价值，故汇总维度合并为 isFree；展示文案在 getSourcePriceText 区分。
    isFree: billing?.amount === "-1" || billing?.amount === "0" || sourceAmount === 0,
    isUsageBased: false,
    isLongTerm: remaining?.isLongTerm || false,
    isFreeTagged: extra.includes("白嫖"),
    sourcePriceText: getSourcePriceText(billing, sourceCurrency),
  }
}

function sortAssetItemsByHomepage(items: AssetItem[], sortType: SortType, sortOrder: SortOrder) {
  return [...items].sort((a, b) => {
    if (sortType !== "name") {
      if (!a.formatted.online && b.formatted.online) return 1
      if (a.formatted.online && !b.formatted.online) return -1
      if (!a.formatted.online && !b.formatted.online) return 0
    }

    let comparison = 0
    switch (sortType) {
      case "name":
        comparison = a.name.localeCompare(b.name)
        break
      case "uptime":
        comparison = a.formatted.uptime - b.formatted.uptime
        break
      case "system":
        comparison = a.formatted.platform.localeCompare(b.formatted.platform)
        break
      case "cpu":
        comparison = a.formatted.cpu - b.formatted.cpu
        break
      case "mem":
        comparison = a.formatted.mem - b.formatted.mem
        break
      case "disk":
        comparison = a.formatted.disk - b.formatted.disk
        break
      case "up":
        comparison = a.formatted.up - b.formatted.up
        break
      case "down":
        comparison = a.formatted.down - b.formatted.down
        break
      case "up total":
        comparison = a.formatted.net_out_transfer - b.formatted.net_out_transfer
        break
      case "down total":
        comparison = a.formatted.net_in_transfer - b.formatted.net_in_transfer
        break
      default:
        comparison = a.displayIndex - b.displayIndex
    }

    return sortOrder === "asc" ? comparison : -comparison
  })
}

function getAssetTableSortValue(item: AssetItem, key: AssetTableSortKey): number | null {
  if (key === "remaining") return item.remainingCny
  if (key === "monthly") return item.monthlyCny
  if (!item.billing?.endDate || item.billing.endDate.startsWith("0000-00-00")) return null

  const expiry = Date.parse(item.billing.endDate)
  return Number.isFinite(expiry) ? expiry : null
}

function sortAssetTableItems(items: AssetItem[], state: AssetTableSortState) {
  if (!state) return items

  return [...items].sort((a, b) => {
    const valueA = getAssetTableSortValue(a, state.key)
    const valueB = getAssetTableSortValue(b, state.key)
    if (valueA === null && valueB === null) return 0
    if (valueA === null) return 1
    if (valueB === null) return -1
    return state.direction === "desc" ? valueB - valueA : valueA - valueB
  })
}

function useExchangeRates(refreshKey: number) {
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES)
  const [status, setStatus] = useState("使用默认汇率")

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)

    async function fetchRates() {
      const apis = ["https://open.er-api.com/v6/latest/CNY", "https://api.exchangerate-api.com/v4/latest/CNY"]

      for (const url of apis) {
        try {
          const res = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
          })
          if (!res.ok) {
            continue
          }
          const data = (await res.json()) as { rates?: ExchangeRates }
          if (data.rates && !cancelled) {
            setRates({ ...DEFAULT_EXCHANGE_RATES, ...data.rates, ...getStoredRateOverrides(), CNY: 1 })
            setStatus(`汇率更新: ${new Date().toLocaleTimeString()}`)
            return
          }
        } catch {
          // Try the next provider, then fall back to bundled rates.
        }
      }

      if (!cancelled) {
        setRates({ ...DEFAULT_EXCHANGE_RATES, ...getStoredRateOverrides(), CNY: 1 })
        setStatus("使用默认汇率")
      }
    }

    fetchRates()

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [refreshKey])

  return { rates, status, setRates }
}

export default function AssetSummaryWidget({ now, servers }: AssetSummaryWidgetProps) {
  const { sortType, sortOrder } = useSort()
  const [open, setOpen] = useState(false)
  const summaryRef = useRef<HTMLElement>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [targetCurrency, setTargetCurrency] = useState(getInitialCurrency)
  const [excludeFree, setExcludeFree] = useState(localStorage.getItem("asset_card_exclude_free") !== "false")
  const [tableSort, setTableSort] = useState<AssetTableSortState>(null)
  const [financeTab, setFinanceTab] = useState<FinanceTab>("fixed")
  const [snapshotAt, setSnapshotAt] = useState(Date.now())
  const [selectedMeteredId, setSelectedMeteredId] = useState<number | null>(null)
  const [meteredSettings, setMeteredSettings] = useState<MeteredSettings>(() => getDefaultMeteredSettings(getInitialCurrency()))
  const [tradeItem, setTradeItem] = useState<AssetItem | null>(null)
  const [tradeAmount, setTradeAmount] = useState("")
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().slice(0, 10))
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle")
  const { rates, status, setRates } = useExchangeRates(refreshKey)

  useEffect(() => {
    const openAssetSummary = () => {
      setSnapshotAt(Date.now())
      setTableSort(null)
      setOpen(true)
    }
    window.addEventListener(ASSET_SUMMARY_OPEN_EVENT, openAssetSummary)
    return () => window.removeEventListener(ASSET_SUMMARY_OPEN_EVENT, openAssetSummary)
  }, [])

  useEffect(() => {
    if (!open && !tradeItem) return

    const closeTopmostOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (tradeItem) setTradeItem(null)
      else setOpen(false)
    }

    window.addEventListener("keydown", closeTopmostOnEscape)
    return () => window.removeEventListener("keydown", closeTopmostOnEscape)
  }, [open, tradeItem])

  useEffect(() => {
    if (!open || tradeItem) return

    const closeSummaryOnOutsidePress = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !summaryRef.current?.contains(target)) setOpen(false)
    }

    document.addEventListener("pointerdown", closeSummaryOnOutsidePress)
    return () => document.removeEventListener("pointerdown", closeSummaryOnOutsidePress)
  }, [open, tradeItem])

  const palette = useMemo(() => {
    const colorKey = resolveAssetColor((window as unknown as Record<string, unknown>).AssetCardColor)
    return ASSET_COLORS[colorKey]
  }, [])

  const items = useMemo(() => servers.map((server) => buildAssetItem(now, server, rates)), [now, rates, servers])

  useEffect(() => {
    const openAssetTrade = (event: Event) => {
      const detail = (event as CustomEvent<{ serverId: number }>).detail
      const item = detail ? items.find((candidate) => candidate.id === detail.serverId) : undefined
      if (!item) return

      setOpen(false)
      setTradeDate(new Date().toISOString().slice(0, 10))
      setTradeAmount("")
      setCopyStatus("idle")
      setTradeItem(item)
    }

    window.addEventListener(ASSET_TRADE_OPEN_EVENT, openAssetTrade)
    return () => window.removeEventListener(ASSET_TRADE_OPEN_EVENT, openAssetTrade)
  }, [items])

  const visibleItems = useMemo(() => {
    const filtered = excludeFree ? items.filter((item) => !item.isFree && !item.isUsageBased && !item.isFreeTagged) : items
    return sortAssetItemsByHomepage(filtered, sortType, sortOrder)
  }, [excludeFree, items, sortOrder, sortType])
  const tableItems = useMemo(() => sortAssetTableItems(visibleItems, tableSort), [tableSort, visibleItems])

  const totals = useMemo(() => {
    return visibleItems.reduce(
      (acc, item) => {
        acc.unresolved += item.sourceAmount !== null && item.priceCny === null && !item.isFree && !item.isUsageBased ? 1 : 0
        acc.total += item.priceCny ?? 0
        acc.monthly += item.monthlyCny ?? 0
        acc.remaining += item.remainingCny ?? 0
        return acc
      },
      { monthly: 0, remaining: 0, total: 0, unresolved: 0 },
    )
  }, [visibleItems])

  useEffect(() => {
    if (!open) return
    const selected = visibleItems.find((item) => item.id === selectedMeteredId) || visibleItems[0]
    if (!selected) {
      setSelectedMeteredId(null)
      return
    }
    if (selected.id !== selectedMeteredId) {
      setSelectedMeteredId(selected.id)
      setMeteredSettings(getStoredMeteredSettings(selected.id, targetCurrency))
    }
  }, [open, selectedMeteredId, targetCurrency, visibleItems])

  const selectedMeteredItem = visibleItems.find((item) => item.id === selectedMeteredId) || null
  const meteredEstimate = useMemo(() => {
    if (!selectedMeteredItem?.formatted.online) return null

    const up = Math.max(0, Number(selectedMeteredItem.formatted.net_out_transfer) || 0)
    const down = Math.max(0, Number(selectedMeteredItem.formatted.net_in_transfer) || 0)
    const trafficBytes =
      meteredSettings.trafficMode === "up"
        ? up
        : meteredSettings.trafficMode === "down"
          ? down
          : meteredSettings.trafficMode === "max"
            ? Math.max(up, down)
            : up + down
    const trafficTiB = trafficBytes / TIB_BYTES
    const trafficCost = trafficTiB * meteredSettings.trafficRate
    const timeCost = meteredSettings.manualHours * meteredSettings.timeRate
    const totalCost = trafficCost + timeCost + meteredSettings.oneTimeFee
    const totalCny = amountToCny(totalCost, meteredSettings.currency, rates)

    return { trafficTiB, trafficCost, timeCost, totalCost, totalCny }
  }, [meteredSettings, rates, selectedMeteredItem])

  const targetRate = rates[targetCurrency] || 1
  const exchangeRows = DISPLAY_CURRENCIES.filter((currency) => currency !== targetCurrency && rates[currency]).map((currency) => ({
    currency,
    value: rates[targetCurrency] / rates[currency],
  }))

  const selectedTradeRemaining = useMemo(() => {
    if (!tradeItem?.billing || tradeItem.sourceAmount === null) {
      return tradeItem?.remainingCny ?? null
    }

    const asOf = new Date(`${tradeDate}T00:00:00`)
    const remaining = calculateRemainingBillingValue(tradeItem.billing, tradeItem.sourceAmount, asOf)
    return amountToCny(remaining.value, tradeItem.sourceCurrency, rates)
  }, [rates, tradeDate, tradeItem])

  const tradeRemainingValue = cnyToCurrency(selectedTradeRemaining, targetCurrency, rates)
  const tradeAmountValue = Number(tradeAmount)
  const hasValidTradeAmount = tradeAmount.trim() !== "" && Number.isFinite(tradeAmountValue) && tradeAmountValue >= 0
  const premiumValue = hasValidTradeAmount && tradeRemainingValue !== null ? tradeAmountValue - tradeRemainingValue : null
  const premiumRate = premiumValue !== null && tradeRemainingValue && tradeRemainingValue > 0 ? (premiumValue / tradeRemainingValue) * 100 : null
  const canCopyTrade = hasValidTradeAmount && premiumValue !== null

  const persistCurrency = (currency: string) => {
    setTargetCurrency(currency)
    setCopyStatus("idle")
    localStorage.setItem("asset_card_currency", currency)
  }

  const cycleTableSort = (key: AssetTableSortKey) => {
    setTableSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" }
      if (current.direction === "desc") return { key, direction: "asc" }
      return null
    })
  }

  const renderTableSortIcon = (key: AssetTableSortKey) => {
    if (tableSort?.key !== key) return <ChevronsUpDown className="size-3.5 opacity-45" />
    return tableSort.direction === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />
  }

  const toggleFree = () => {
    const nextValue = !excludeFree
    setExcludeFree(nextValue)
    localStorage.setItem("asset_card_exclude_free", String(nextValue))
  }

  const persistMeteredSettings = (next: MeteredSettings) => {
    setMeteredSettings(next)
    if (selectedMeteredId !== null) localStorage.setItem(getMeteredStorageKey(selectedMeteredId), JSON.stringify(next))
  }

  const updateMeteredNumber = (key: "trafficRate" | "timeRate" | "manualHours" | "oneTimeFee", rawValue: string) => {
    const value = rawValue.trim() === "" ? 0 : Number(rawValue)
    if (!Number.isFinite(value) || value < 0 || value > MAX_METERED_INPUT) return
    persistMeteredSettings({ ...meteredSettings, [key]: value })
  }

  const selectMeteredItem = (serverId: number) => {
    setSelectedMeteredId(serverId)
    setMeteredSettings(getStoredMeteredSettings(serverId, targetCurrency))
  }

  const clearMeteredSettings = () => {
    if (selectedMeteredId === null) return
    localStorage.removeItem(getMeteredStorageKey(selectedMeteredId))
    setMeteredSettings(getDefaultMeteredSettings(targetCurrency))
  }

  const updateExchangeRate = (currency: string, rawValue: string) => {
    if (currency === "CNY") return
    const value = Number(rawValue)
    if (!Number.isFinite(value) || value <= 0 || value > MAX_METERED_INPUT) return

    const overrides = { ...getStoredRateOverrides(), [currency]: value }
    localStorage.setItem(RATE_OVERRIDES_KEY, JSON.stringify(overrides))
    setRates((current) => ({ ...current, [currency]: value, CNY: 1 }))
  }

  const resetExchangeRates = () => {
    localStorage.removeItem(RATE_OVERRIDES_KEY)
    setRefreshKey((value) => value + 1)
  }

  const openTradeCalculator = (item: AssetItem) => {
    setTradeDate(new Date().toISOString().slice(0, 10))
    setTradeAmount("")
    setCopyStatus("idle")
    setTradeItem(item)
  }

  const handleCopyTrade = async () => {
    if (!tradeItem || !canCopyTrade || premiumValue === null) {
      return
    }

    const trafficUsed = calcTrafficUsed(
      tradeItem.formatted.net_out_transfer,
      tradeItem.formatted.net_in_transfer,
      tradeItem.formatted.traffic_limit_type,
    )
    const premiumRateText = premiumRate === null ? "-" : `${premiumRate > 0 ? "+" : ""}${premiumRate.toFixed(2)}%`
    const markdown = [
      "### 服务器信息",
      "",
      buildMarkdownTable([
        ["名称", tradeItem.name],
        ["CPU", `${tradeItem.formatted.cpu.toFixed(2)}%`],
        ["内存", formatBytes(tradeItem.formatted.mem_total)],
        ["硬盘", formatBytes(tradeItem.formatted.disk_total)],
        ["流量额度", tradeItem.formatted.traffic_limit > 0 ? formatBytes(tradeItem.formatted.traffic_limit) : "无限制"],
        ["已用流量", formatBytes(trafficUsed)],
        ["原价", tradeItem.sourcePriceText],
        ["到期时间", formatEndDate(tradeItem.billing?.endDate)],
      ]),
      "",
      "### 交易信息",
      "",
      buildMarkdownTable([
        ["交易日期", tradeDate],
        ["交易币种", targetCurrency],
        ["交易金额", formatMoney(tradeAmountValue, targetCurrency)],
        ["剩余价值", formatMoney(tradeRemainingValue, targetCurrency)],
        ["溢价金额", formatMoney(premiumValue, targetCurrency)],
        ["溢价率", premiumRateText],
      ]),
    ].join("\n")

    try {
      await copyTextToClipboard(markdown)
      setCopyStatus("copied")
    } catch {
      setCopyStatus("error")
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[1040] flex items-center justify-center bg-black/25 px-3 py-4 backdrop-blur-sm sm:px-5">
          <section
            ref={summaryRef}
            role="dialog"
            aria-modal="true"
            aria-label="价值与费用明细"
            className="glass-card asset-glass flex max-h-[94vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl border border-white/15 text-white shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5">
              <div>
                <h3 className={cn("flex items-center gap-2 text-base font-bold", palette.panelTitle)}>
                  <CircleDollarSign className="size-4" />
                  价值与费用明细
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">固定账单、纯前端按量估算与汇率设置</p>
              </div>
              <button
                type="button"
                aria-label="关闭价值与费用明细"
                className={cn("rounded-full p-1.5 text-muted-foreground transition", palette.hoverPrimary)}
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-hidden sm:p-5">
              <div className="grid grid-cols-3 divide-x divide-border/60 border-y border-border/60 py-3 text-center">
                <div className="min-w-0 px-2">
                  <p className="text-[11px] text-muted-foreground sm:text-xs">剩余价值</p>
                  <p className={cn("mt-1 truncate text-base font-semibold tabular-nums sm:text-lg", palette.primaryText)}>
                    {formatMoney(totals.remaining * targetRate, targetCurrency)}
                  </p>
                </div>
                <div className="min-w-0 px-2">
                  <p className="text-[11px] text-muted-foreground sm:text-xs">固定月均支出</p>
                  <p className={cn("mt-1 truncate text-base font-semibold tabular-nums sm:text-lg", palette.primaryText)}>
                    {formatMoney(totals.monthly * targetRate, targetCurrency)}
                  </p>
                </div>
                <div className="min-w-0 px-2">
                  <p className="text-[11px] text-muted-foreground sm:text-xs">年均支出</p>
                  <p className={cn("mt-1 truncate text-base font-semibold tabular-nums sm:text-lg", palette.primaryText)}>
                    {formatMoney(totals.monthly * 12 * targetRate, targetCurrency)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 rounded-lg border border-border bg-muted/30 p-1">
                  {(
                    [
                      ["fixed", "固定账单", CalendarDays],
                      ["metered", "按量估算", Calculator],
                      ["rates", "汇率设置", CircleDollarSign],
                    ] as const
                  ).map(([tab, label, Icon]) => (
                    <button
                      key={tab}
                      type="button"
                      className={cn(
                        "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition sm:px-3",
                        financeTab === tab ? "bg-white/15 text-white shadow-sm" : "text-muted-foreground hover:bg-white/[0.08] hover:text-white",
                      )}
                      onClick={() => setFinanceTab(tab)}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" className="size-4 accent-current" checked={excludeFree} onChange={toggleFree} />
                  排除免费节点
                </label>
              </div>

              {financeTab === "fixed" && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold">固定账单明细</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">沿用 Komari 节点价格、周期及到期时间。</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">点击表头：降序 → 升序 → 首页顺序</span>
                      <select
                        aria-label="显示币种"
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none"
                        value={targetCurrency}
                        onChange={(event) => persistCurrency(event.target.value)}
                      >
                        {DISPLAY_CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency} ({CURRENCY_SYMBOLS[currency]})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {totals.unresolved > 0 && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      <HelpCircle className="mt-0.5 size-3.5 shrink-0" />
                      <span>{totals.unresolved} 台服务器的币种未配置或无法换算，未计入汇总。</span>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-lg border border-border/70">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="bg-muted/45 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2.5 font-medium">节点</th>
                          <th className="px-3 py-2.5 font-medium">固定费用</th>
                          <th
                            className="px-3 py-2.5 font-medium"
                            aria-sort={tableSort?.key === "expiry" ? (tableSort.direction === "desc" ? "descending" : "ascending") : "none"}
                          >
                            <button
                              type="button"
                              className="flex items-center gap-1 transition hover:text-white"
                              onClick={() => cycleTableSort("expiry")}
                            >
                              到期
                              {renderTableSortIcon("expiry")}
                            </button>
                          </th>
                          <th
                            className="px-3 py-2.5 font-medium"
                            aria-sort={tableSort?.key === "remaining" ? (tableSort.direction === "desc" ? "descending" : "ascending") : "none"}
                          >
                            <button
                              type="button"
                              className="flex items-center gap-1 transition hover:text-white"
                              onClick={() => cycleTableSort("remaining")}
                            >
                              剩余价值
                              {renderTableSortIcon("remaining")}
                            </button>
                          </th>
                          <th
                            className="px-3 py-2.5 text-right font-medium"
                            aria-sort={tableSort?.key === "monthly" ? (tableSort.direction === "desc" ? "descending" : "ascending") : "none"}
                          >
                            <button
                              type="button"
                              className="ml-auto flex items-center gap-1 transition hover:text-white"
                              onClick={() => cycleTableSort("monthly")}
                            >
                              月均支出
                              {renderTableSortIcon("monthly")}
                            </button>
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {tableItems.map((item) => {
                          const expiryLabel = item.isLongTerm
                            ? "长期"
                            : item.isExpired
                              ? "已过期"
                              : item.remainingDays === null
                                ? "未设置"
                                : item.remainingDays === 0
                                  ? "今天"
                                  : `${item.remainingDays} 天`
                          return (
                            <tr key={item.id} className="transition hover:bg-white/[0.05]">
                              <td className="max-w-52 px-3 py-2.5">
                                <p className="truncate font-medium" title={item.name}>
                                  {item.name}
                                </p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">{item.sourcePriceText}</td>
                              <td className="whitespace-nowrap px-3 py-2.5">{expiryLabel}</td>
                              <td className={cn("whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums", palette.primaryText)}>
                                {item.isFree ? "无" : formatMoney(cnyToCurrency(item.remainingCny, targetCurrency, rates), targetCurrency)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">
                                {formatMoney(cnyToCurrency(item.monthlyCny, targetCurrency, rates), targetCurrency)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  className={cn("rounded-md border border-border px-2 py-1 text-[11px] transition", palette.hoverPrimary)}
                                  onClick={() => openTradeCalculator(item)}
                                >
                                  交易计算
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        {visibleItems.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                              暂无账单节点
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      共 {visibleItems.length} 台 · 总价值 {formatMoney(totals.total * targetRate, targetCurrency)} · 年均支出{" "}
                      {formatMoney(totals.monthly * 12 * targetRate, targetCurrency)}
                    </span>
                    <span>{status}</span>
                  </div>
                </div>
              )}

              {financeTab === "metered" && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-sky-400/20 bg-sky-400/[0.08] px-3 py-2 text-xs text-muted-foreground">
                    按量费用仅在当前浏览器估算，不写入 Komari。累计流量可能因机器或 Agent 重启而重置；1 TiB = 1024⁴ bytes，结果不代表正式账单。
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="grid gap-1 text-xs">
                      <span className="font-medium">估算节点</span>
                      <select
                        aria-label="估算节点"
                        className="h-9 min-w-0 rounded-md border border-border bg-background px-2 outline-none"
                        value={selectedMeteredId ?? ""}
                        onChange={(event) => selectMeteredItem(Number(event.target.value))}
                      >
                        {visibleItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="font-medium">流量口径</span>
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 outline-none"
                        value={meteredSettings.trafficMode}
                        onChange={(event) => persistMeteredSettings({ ...meteredSettings, trafficMode: event.target.value as TrafficMode })}
                      >
                        {Object.entries(TRAFFIC_MODE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="font-medium">计价币种</span>
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 outline-none"
                        value={meteredSettings.currency}
                        onChange={(event) => persistMeteredSettings({ ...meteredSettings, currency: event.target.value })}
                      >
                        {DISPLAY_CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="font-medium">显示币种</span>
                      <select
                        className="h-9 rounded-md border border-border bg-background px-2 outline-none"
                        value={targetCurrency}
                        onChange={(event) => persistCurrency(event.target.value)}
                      >
                        {DISPLAY_CURRENCIES.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {(
                      [
                        ["trafficRate", "流量单价 / TiB"],
                        ["timeRate", "小时单价 / h"],
                        ["manualHours", "手工计费小时"],
                        ["oneTimeFee", "本次附加费用"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="grid gap-1 text-xs">
                        <span className="font-medium">{label}</span>
                        <input
                          type="number"
                          min="0"
                          max={MAX_METERED_INPUT}
                          step="any"
                          className={cn(
                            "h-9 min-w-0 rounded-md border border-border bg-background px-2.5 tabular-nums outline-none focus:ring-2",
                            palette.focusInput,
                          )}
                          value={meteredSettings[key]}
                          onChange={(event) => updateMeteredNumber(key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>快照：{new Date(snapshotAt).toLocaleString()}</span>
                    <button
                      type="button"
                      className={cn("ml-auto rounded-md border border-border px-2.5 py-1.5 transition", palette.hoverPrimary)}
                      disabled={!selectedMeteredItem}
                      onClick={() =>
                        selectedMeteredItem &&
                        persistMeteredSettings({ ...meteredSettings, manualHours: selectedMeteredItem.formatted.uptime / 3600 })
                      }
                    >
                      带入当前 uptime
                    </button>
                    <button
                      type="button"
                      className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 transition", palette.hoverPrimary)}
                      onClick={clearMeteredSettings}
                    >
                      <Trash2 className="size-3.5" />
                      清除本地配置
                    </button>
                  </div>

                  {!selectedMeteredItem?.formatted.online || !meteredEstimate ? (
                    <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.08] px-3 py-6 text-center text-sm text-amber-200">
                      当前节点离线或没有可用的实时累计流量，无法进行本次估算。
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 divide-x divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70 md:grid-cols-4 md:divide-y-0">
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">计费流量</p>
                        <p className="mt-1 font-semibold tabular-nums">{formatEstimateTraffic(meteredEstimate.trafficTiB)}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{TRAFFIC_MODE_LABELS[meteredSettings.trafficMode]}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">流量费用</p>
                        <p className="mt-1 font-semibold tabular-nums">{formatMoney(meteredEstimate.trafficCost, meteredSettings.currency)}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">时间 / 附加</p>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatMoney(meteredEstimate.timeCost, meteredSettings.currency)} /{" "}
                          {formatMoney(meteredSettings.oneTimeFee, meteredSettings.currency)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">手工 {formatEstimateHours(meteredSettings.manualHours)}</p>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">显示金额</p>
                        <p className={cn("mt-1 text-lg font-semibold tabular-nums", palette.primaryText)}>
                          {formatMoney(cnyToCurrency(meteredEstimate.totalCny, targetCurrency, rates), targetCurrency)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          源币种小计 {formatMoney(meteredEstimate.totalCost, meteredSettings.currency)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {financeTab === "rates" && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-auto">
                      <h4 className="text-sm font-semibold">汇率</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">{status} · 1 CNY 对应数值；修改后保存在当前浏览器。</p>
                    </div>
                    <select
                      aria-label="汇率显示币种"
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs outline-none"
                      value={targetCurrency}
                      onChange={(event) => persistCurrency(event.target.value)}
                    >
                      {DISPLAY_CURRENCIES.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={cn("flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs transition", palette.hoverPrimary)}
                      onClick={resetExchangeRates}
                    >
                      <RefreshCw className="size-3.5" />
                      恢复今日汇率
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {DISPLAY_CURRENCIES.map((currency) => (
                      <label key={currency} className="grid grid-cols-[3rem_1fr] items-center gap-2 text-xs">
                        <span className="font-medium">{currency}</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={currency === "CNY"}
                          className={cn(
                            "h-9 min-w-0 rounded-md border border-border bg-background px-2.5 tabular-nums outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                            palette.focusInput,
                          )}
                          value={rates[currency] ?? ""}
                          onChange={(event) => updateExchangeRate(currency, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/25 p-3 text-xs text-muted-foreground sm:grid-cols-2">
                    {exchangeRows.map((row) => (
                      <div key={row.currency} className="flex justify-between gap-3">
                        <span>1 {row.currency}</span>
                        <span className={cn("font-medium tabular-nums", palette.primaryText)}>{formatMoney(row.value, targetCurrency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {tradeItem && (
        <div className="fixed inset-0 z-[1999] flex items-center justify-center bg-black/20 px-4 backdrop-blur-sm" onClick={() => setTradeItem(null)}>
          <section
            className="glass-card asset-glass max-h-[96vh] w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/15 text-white shadow-none backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className={cn("flex items-center gap-2 text-sm font-bold", palette.panelTitle)}>
                <CircleDollarSign className="size-4" />
                服务器交易
              </h3>
              <button
                type="button"
                aria-label="关闭交易计算"
                className={cn("rounded-full p-1 text-muted-foreground transition", palette.hoverPrimary)}
                onClick={() => setTradeItem(null)}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[calc(96vh-52px)] overflow-y-auto p-4 scrollbar-hidden">
              <div className={cn("mb-2 text-sm font-bold", palette.panelTitle)}>服务器信息</div>
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-muted/30 text-[13px]">
                <div className="border-b border-r border-border p-2">
                  <span className="text-muted-foreground">名称</span>
                  <p className="font-medium">{tradeItem.name}</p>
                </div>
                <div className="border-b border-border p-2">
                  <span className="text-muted-foreground">CPU</span>
                  <p className="font-medium">{tradeItem.formatted.cpu.toFixed(2)}%</p>
                </div>
                <div className="border-b border-r border-border p-2">
                  <span className="text-muted-foreground">内存</span>
                  <p className="font-medium">{formatBytes(tradeItem.formatted.mem_total)}</p>
                </div>
                <div className="border-b border-border p-2">
                  <span className="text-muted-foreground">硬盘</span>
                  <p className="font-medium">{formatBytes(tradeItem.formatted.disk_total)}</p>
                </div>
                <div className="border-b border-r border-border p-2">
                  <span className="text-muted-foreground">流量</span>
                  <p className="font-medium">
                    {tradeItem.formatted.traffic_limit > 0
                      ? `${formatBytes(
                          calcTrafficUsed(
                            tradeItem.formatted.net_out_transfer,
                            tradeItem.formatted.net_in_transfer,
                            tradeItem.formatted.traffic_limit_type,
                          ),
                        )} / ${formatBytes(tradeItem.formatted.traffic_limit)}`
                      : "-"}
                  </p>
                </div>
                <div className="border-b border-border p-2">
                  <span className="text-muted-foreground">原价</span>
                  <p className="font-medium">{tradeItem.sourcePriceText}</p>
                </div>
                <div className="col-span-2 p-2">
                  <span className="text-muted-foreground">到期时间</span>
                  <p className="font-medium">{formatEndDate(tradeItem.billing?.endDate)}</p>
                </div>
              </div>

              <div className="my-3 h-px bg-border" />
              <div className={cn("mb-2 text-sm font-bold", palette.panelTitle)}>交易计算</div>
              <div className="grid gap-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid min-w-0 gap-1 text-[13px] font-semibold text-muted-foreground">
                    交易日期
                    <input
                      className={cn(
                        "h-9 min-w-0 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:ring-2",
                        palette.focusInput,
                      )}
                      type="date"
                      value={tradeDate}
                      onChange={(event) => {
                        setTradeDate(event.target.value)
                        setCopyStatus("idle")
                      }}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-[13px] font-semibold text-muted-foreground">
                    交易金额
                    <input
                      className={cn(
                        "h-9 min-w-0 w-full rounded-md border-2 border-border bg-background px-2.5 text-sm font-bold outline-none transition focus:ring-2",
                        palette.primaryText,
                        palette.focusInput,
                      )}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="请输入交易金额"
                      value={tradeAmount}
                      onChange={(event) => {
                        setTradeAmount(event.target.value)
                        setCopyStatus("idle")
                      }}
                    />
                  </label>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-0.5 text-[13px]">
                  <div className="flex justify-between border-b border-border py-1.5">
                    <span className="text-muted-foreground">剩余价值</span>
                    <span className={cn("font-semibold", palette.primaryText)}>{formatMoney(tradeRemainingValue, targetCurrency)}</span>
                  </div>
                  <div className="flex justify-between border-b border-border py-1.5">
                    <span className="text-muted-foreground">溢价金额</span>
                    <span className={cn("font-semibold text-red-600", premiumValue !== null && premiumValue <= 0 && "text-green-600")}>
                      {premiumValue === null ? "-" : formatMoney(premiumValue, targetCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">溢价率</span>
                    <span className={cn("font-semibold text-red-600", premiumValue !== null && premiumValue <= 0 && "text-green-600")}>
                      {premiumRate === null ? "-" : `${premiumRate > 0 ? "+" : ""}${premiumRate.toFixed(2)}%`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/15 px-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!canCopyTrade}
                  onClick={handleCopyTrade}
                  title={canCopyTrade ? "复制交易信息 Markdown 表格" : "请先填写交易金额并确保剩余价值可计算"}
                >
                  {copyStatus === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copyStatus === "copied" ? "已复制 Markdown" : copyStatus === "error" ? "复制失败，请重试" : "复制 Markdown 表格"}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
