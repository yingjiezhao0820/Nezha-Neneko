import { NetworkChart } from "@/components/NetworkChart"
import { NetworkTrafficChart } from "@/components/NetworkTrafficChart"
import ServerDetailOverview from "@/components/ServerDetailOverview"
import { useEffect } from "react"
import { Navigate, useParams } from "react-router-dom"

export default function ServerDetail() {
  const { id: serverId } = useParams()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])

  if (!serverId) {
    return <Navigate to="/404" replace />
  }

  const showNetworkTrafficChart = (window as unknown as Record<string, unknown>).ShowServerDetailNetworkTrafficChart !== false

  return (
    <div className="server-info mx-auto flex w-full max-w-5xl flex-col px-0 pb-2 sm:pb-4">
      <ServerDetailOverview server_id={serverId} />
      <div className="mt-4">
        <NetworkChart server_id={Number(serverId)} show={true} />
      </div>
      {showNetworkTrafficChart && (
        <div className="mt-4">
          <NetworkTrafficChart server_id={Number(serverId)} />
        </div>
      )}
    </div>
  )
}
