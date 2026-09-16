import { NetworkChart } from "@/components/NetworkChart"
import ServerDetailOverview from "@/components/ServerDetailOverview"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { formatNezhaInfo } from "@/lib/utils"
import { useEffect, useMemo, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

function useClock() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return [time.getHours(), time.getMinutes(), time.getSeconds()].map((value) => String(value).padStart(2, "0")).join(":")
}

export default function ServerDetail() {
  const { id: serverId } = useParams()
  const { lastMessage } = useWebSocketContext()
  const currentTime = useClock()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])

  const onlineCount = useMemo(() => {
    if (!lastMessage) return 0
    return lastMessage.servers.filter((server) => formatNezhaInfo(lastMessage.now, server).online).length
  }, [lastMessage])

  if (!serverId) {
    return <Navigate to="/404" replace />
  }

  return (
    <div className="server-info mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col px-0 text-white">
      <header className="relative h-40 shrink-0 sm:h-44">
        <div className="absolute right-0 top-0 flex items-center gap-2 rounded-full bg-black/20 px-3 py-2 text-xs font-medium backdrop-blur-md">
          <span>{onlineCount}</span>
          <span>在线</span>
          <span className="size-2 rounded-full bg-emerald-500" />
        </div>
        <time className="absolute bottom-5 left-0 text-4xl font-medium tracking-wide tabular-nums sm:text-5xl">{currentTime}</time>
      </header>

      <ServerDetailOverview server_id={serverId} />
      <div className="mt-4">
        <NetworkChart server_id={Number(serverId)} show={true} />
      </div>

      <div className="mt-auto pt-16">
        <div className="mx-auto w-full rounded-full border border-white/10 bg-black/20 px-5 py-2 text-center text-[11px] text-white/75 backdrop-blur-md">
          Powered by Komari Monitor
        </div>
      </div>
    </div>
  )
}
