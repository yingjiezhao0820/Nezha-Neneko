import AssetSummaryWidget from "@/components/AssetSummaryWidget"
import GlobalMap from "@/components/GlobalMap"
import GroupSwitch from "@/components/GroupSwitch"
import ServerCard from "@/components/ServerCard"
import ServerCardInline from "@/components/ServerCardInline"
import ServerOverview from "@/components/ServerOverview"
import { ServiceTracker } from "@/components/ServiceTracker"
import VisitorCapsuleBar from "@/components/VisitorCapsuleBar"
import { Loader } from "@/components/loading/Loader"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SORT_ORDERS, SORT_TYPES } from "@/context/sort-context"
import { useSort } from "@/hooks/use-sort"
import { useStatus } from "@/hooks/use-status"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { fetchServerGroup } from "@/lib/nezha-api"
import { cn, formatNezhaInfo } from "@/lib/utils"
import { ServerGroup } from "@/types/nezha-api"
import { ArrowDownIcon, ArrowUpIcon, ArrowsUpDownIcon, ChartBarSquareIcon, MapIcon, ViewColumnsIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

export default function Servers() {
  const { t } = useTranslation()
  const { sortType, sortOrder, setSortOrder, setSortType } = useSort()
  const { data: groupData } = useQuery({
    queryKey: ["server-group"],
    queryFn: () => fetchServerGroup(),
  })
  const { lastMessage, connected } = useWebSocketContext()
  const { status } = useStatus()
  const [showServices, setShowServices] = useState<string>("0")
  const [showMap, setShowMap] = useState<string>("0")
  const [inline, setInline] = useState<string>("0")
  const containerRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [currentGroup, setCurrentGroup] = useState<string>("All")

  const customBackgroundImage = (window.CustomBackgroundImage as string) !== "" ? window.CustomBackgroundImage : undefined
  const themeSettings = window as unknown as Record<string, unknown>
  const showVisitorCapsule = themeSettings.ShowVisitorCapsule === true
  const showAssetCard = themeSettings.ShowAssetCard === true
  const showGroupBar = themeSettings.ShowGroupBar !== false

  const restoreScrollPosition = () => {
    const savedPosition = sessionStorage.getItem("scrollPosition")
    if (savedPosition && containerRef.current) {
      containerRef.current.scrollTop = Number(savedPosition)
    }
  }

  const handleTagChange = (newGroup: string) => {
    setCurrentGroup(newGroup)
    sessionStorage.setItem("selectedGroup", newGroup)
    sessionStorage.setItem("scrollPosition", String(containerRef.current?.scrollTop || 0))
  }

  useEffect(() => {
    const showServicesState = localStorage.getItem("showServices")
    if (window.ForceShowServices) {
      setShowServices("1")
    } else if (showServicesState !== null) {
      setShowServices(showServicesState)
    }
  }, [])

  useEffect(() => {
    const checkInlineSettings = () => {
      const isMobile = window.innerWidth < 768

      if (!isMobile) {
        const inlineState = localStorage.getItem("inline")
        if (window.ForceCardInline) {
          setInline("1")
        } else if (inlineState !== null) {
          setInline(inlineState)
        }
      }
    }

    checkInlineSettings()

    window.addEventListener("resize", checkInlineSettings)

    return () => {
      window.removeEventListener("resize", checkInlineSettings)
    }
  }, [])

  useEffect(() => {
    const showMapState = localStorage.getItem("showMap")
    if (window.ForceShowMap) {
      setShowMap("1")
    } else if (showMapState !== null) {
      setShowMap(showMapState)
    }
  }, [])

  useEffect(() => {
    const savedGroup = sessionStorage.getItem("selectedGroup") || "All"
    setCurrentGroup(savedGroup)

    restoreScrollPosition()
  }, [])

  const nezhaWsData = lastMessage

  const groupTabs = [
    "All",
    ...(groupData?.data
      ?.filter((item: ServerGroup) => {
        return Array.isArray(item.servers) && item.servers.some((serverId) => nezhaWsData?.servers?.some((server) => server.id === serverId))
      })
      ?.map((item: ServerGroup) => item.group.name) || []),
  ]

  const {
    groupFilteredServers,
    filteredServers,
    totalServers,
    onlineServers,
    offlineServers,
    up,
    down,
    upSpeed,
    downSpeed,
  } = useMemo(() => {
    if (!nezhaWsData) {
      return {
        groupFilteredServers: [],
        filteredServers: [],
        totalServers: 0,
        onlineServers: 0,
        offlineServers: 0,
        up: 0,
        down: 0,
        upSpeed: 0,
        downSpeed: 0,
      }
    }

    const selectedGroup = groupData?.data?.find((group: ServerGroup) => group.group.name === currentGroup)
    const rows = nezhaWsData.servers
      .filter((server) => currentGroup === "All" || selectedGroup?.servers?.includes(server.id))
      .map((server) => ({ server, info: formatNezhaInfo(nezhaWsData.now, server) }))

    const summary = rows.reduce(
      (result, { server, info }) => {
        if (info.online) {
          result.onlineServers += 1
          result.up += server.state?.net_out_transfer ?? 0
          result.down += server.state?.net_in_transfer ?? 0
          result.upSpeed += server.state?.net_out_speed ?? 0
          result.downSpeed += server.state?.net_in_speed ?? 0
        } else {
          result.offlineServers += 1
        }
        return result
      },
      { onlineServers: 0, offlineServers: 0, up: 0, down: 0, upSpeed: 0, downSpeed: 0 },
    )

    const visibleRows = rows.filter(({ info }) => status === "all" || status === (info.online ? "online" : "offline"))
    visibleRows.sort((a, b) => {
      if (sortType !== "name") {
        if (!a.info.online && b.info.online) return 1
        if (a.info.online && !b.info.online) return -1
        if (!a.info.online && !b.info.online) return 0
      }

      let comparison = 0
      switch (sortType) {
        case "name":
          comparison = a.server.name.localeCompare(b.server.name)
          break
        case "uptime":
          comparison = (a.server.state?.uptime ?? 0) - (b.server.state?.uptime ?? 0)
          break
        case "system":
          comparison = a.server.host.platform.localeCompare(b.server.host.platform)
          break
        case "cpu":
          comparison = (a.server.state?.cpu ?? 0) - (b.server.state?.cpu ?? 0)
          break
        case "mem":
          comparison = a.info.mem - b.info.mem
          break
        case "disk":
          comparison = a.info.disk - b.info.disk
          break
        case "up":
          comparison = (a.server.state?.net_out_speed ?? 0) - (b.server.state?.net_out_speed ?? 0)
          break
        case "down":
          comparison = (a.server.state?.net_in_speed ?? 0) - (b.server.state?.net_in_speed ?? 0)
          break
        case "up total":
          comparison = (a.server.state?.net_out_transfer ?? 0) - (b.server.state?.net_out_transfer ?? 0)
          break
        case "down total":
          comparison = (a.server.state?.net_in_transfer ?? 0) - (b.server.state?.net_in_transfer ?? 0)
          break
        default:
          comparison = (a.server.display_index ?? 0) - (b.server.display_index ?? 0)
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return {
      groupFilteredServers: rows.map(({ server }) => server),
      filteredServers: visibleRows.map(({ server }) => server),
      totalServers: rows.length,
      ...summary,
    }
  }, [currentGroup, groupData?.data, nezhaWsData, sortOrder, sortType, status])

  if (!connected && !lastMessage) {
    return (
      <div className="flex min-h-96 flex-col items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader visible={true} />
        </div>
      </div>
    )
  }

  if (!nezhaWsData) {
    return (
      <div className="flex flex-col items-center justify-center">
        <p className="text-sm font-semibold">{t("info.processing")}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-0">
      <ServerOverview
        total={totalServers}
        online={onlineServers}
        offline={offlineServers}
        up={up}
        down={down}
        upSpeed={upSpeed}
        downSpeed={downSpeed}
      />
      {showVisitorCapsule && <VisitorCapsuleBar />}
      {showAssetCard && <AssetSummaryWidget now={nezhaWsData.now} servers={groupFilteredServers} />}
      {showGroupBar && (
        <div className="flex mt-6 items-center justify-between gap-2 server-overview-controls">
        <section className="flex items-center gap-2 w-full overflow-hidden">
          <button
            onClick={() => {
              setShowMap(showMap === "0" ? "1" : "0")
              localStorage.setItem("showMap", showMap === "0" ? "1" : "0")
            }}
            className={cn(
              "rounded-[50px] bg-white dark:bg-stone-800 cursor-pointer p-[10px] transition-all border dark:border-none border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
              {
                "shadow-[inset_0_1px_0_rgba(0,0,0,0.2)] !bg-blue-600 hover:!bg-blue-600 border-blue-600 dark:border-blue-600": showMap === "1",
                "text-white": showMap === "1",
              },
              {
                "bg-opacity-70 dark:bg-opacity-70": customBackgroundImage,
              },
            )}
          >
            <MapIcon
              className={cn("size-[13px]", {
                "text-white": showMap === "1",
              })}
            />
          </button>
          <button
            onClick={() => {
              setShowServices(showServices === "0" ? "1" : "0")
              localStorage.setItem("showServices", showServices === "0" ? "1" : "0")
            }}
            className={cn(
              "rounded-[50px] bg-white dark:bg-stone-800 cursor-pointer p-[10px] transition-all border dark:border-none border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
              {
                "shadow-[inset_0_1px_0_rgba(0,0,0,0.2)] !bg-blue-600 hover:!bg-blue-600 border-blue-600 dark:border-blue-600": showServices === "1",
                "text-white": showServices === "1",
              },
              {
                "bg-opacity-70 dark:bg-opacity-70": customBackgroundImage,
              },
            )}
          >
            <ChartBarSquareIcon
              className={cn("size-[13px]", {
                "text-white": showServices === "1",
              })}
            />
          </button>
          <button
            onClick={() => {
              setInline(inline === "0" ? "1" : "0")
              localStorage.setItem("inline", inline === "0" ? "1" : "0")
            }}
            className={cn(
              "rounded-[50px] bg-white dark:bg-stone-800 cursor-pointer p-[10px] transition-all border dark:border-none border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
              {
                "shadow-[inset_0_1px_0_rgba(0,0,0,0.2)] !bg-blue-600 hover:!bg-blue-600 border-blue-600 dark:border-blue-600": inline === "1",
                "text-white": inline === "1",
              },
              {
                "bg-opacity-70 dark:bg-opacity-70": customBackgroundImage,
              },
            )}
          >
            <ViewColumnsIcon
              className={cn("size-[13px]", {
                "text-white": inline === "1",
              })}
            />
          </button>
          <GroupSwitch tabs={groupTabs} currentTab={currentGroup} setCurrentTab={handleTagChange} />
        </section>
        <Popover onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "rounded-[50px] flex items-center gap-1 dark:text-white border dark:border-none text-black cursor-pointer dark:[text-shadow:_0_1px_0_rgb(0_0_0_/_20%)] dark:bg-stone-800 bg-white  p-[10px] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]  ",
                {
                  "shadow-[inset_0_1px_0_rgba(0,0,0,0.2)] dark:bg-stone-700 bg-stone-200": settingsOpen,
                },
                {
                  "dark:bg-stone-800/70 bg-stone-100/70 ": customBackgroundImage,
                },
              )}
            >
              <p className="text-[10px] font-bold whitespace-nowrap">{sortType === "default" ? "Sort" : sortType.toUpperCase()}</p>
              {sortOrder === "asc" && sortType !== "default" ? (
                <ArrowUpIcon className="size-[13px]" />
              ) : sortOrder === "desc" && sortType !== "default" ? (
                <ArrowDownIcon className="size-[13px]" />
              ) : (
                <ArrowsUpDownIcon className="size-[13px]" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-4 w-[240px] rounded-lg">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Sort by</Label>
                <Select value={sortType} onValueChange={setSortType}>
                  <SelectTrigger className="w-full text-xs h-8">
                    <SelectValue placeholder="Choose type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Sort order</Label>
                <Select value={sortOrder} onValueChange={setSortOrder} disabled={sortType === "default"}>
                  <SelectTrigger className="w-full text-xs h-8">
                    <SelectValue placeholder="Choose order" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_ORDERS.map((order) => (
                      <SelectItem key={order} value={order} className="text-xs">
                        {order.charAt(0).toUpperCase() + order.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        </div>
      )}
      {showMap === "1" && <GlobalMap now={nezhaWsData.now} serverList={nezhaWsData?.servers || []} />}
      {showServices === "1" && <ServiceTracker serverList={filteredServers} />}
      {inline === "1" && (
        <section ref={containerRef} className="flex flex-col gap-2 overflow-x-scroll scrollbar-hidden mt-6 server-inline-list">
          {filteredServers.map((serverInfo) => (
            <ServerCardInline now={nezhaWsData.now} key={serverInfo.id} serverInfo={serverInfo} />
          ))}
        </section>
      )}
      {inline === "0" && (
        <section ref={containerRef} className="grid grid-cols-1 gap-2 md:grid-cols-2 mt-6 server-card-list">
          {filteredServers.map((serverInfo) => (
            <ServerCard now={nezhaWsData.now} key={serverInfo.id} serverInfo={serverInfo} />
          ))}
        </section>
      )}
    </div>
  )
}
