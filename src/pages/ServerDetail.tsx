import CurrentTime from "@/components/CurrentTime"
import { NetworkChart } from "@/components/NetworkChart"
import ServerDetailOverview from "@/components/ServerDetailOverview"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { formatNezhaInfo } from "@/lib/utils"
import { useEffect, useMemo } from "react"
import { Navigate, useParams } from "react-router-dom"

export default function ServerDetail() {
  const { id: serverId } = useParams()
  const { lastMessage } = useWebSocketContext()

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
    <div className="server-info mx-auto flex w-full max-w-5xl flex-col px-0 pb-2 text-white sm:pb-4">
      <header className="relative h-40 shrink-0 sm:h-44">
        <div className="absolute right-0 top-0 flex items-center gap-2 rounded-full bg-black/20 px-3 py-2 text-xs font-medium backdrop-blur-md">
          <span>{onlineCount}</span>
          <span>在线</span>
          <span className="size-2 rounded-full bg-emerald-500" />
        </div>
        <CurrentTime className="absolute bottom-5 left-0" />
      </header>

      <ServerDetailOverview server_id={serverId} />
      <div className="mt-4">
        <NetworkChart server_id={Number(serverId)} show={true} />
      </div>

    </div>
  )
}
