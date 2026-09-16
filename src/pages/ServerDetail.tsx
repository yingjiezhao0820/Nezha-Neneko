import CurrentTime from "@/components/CurrentTime"
import { NetworkChart } from "@/components/NetworkChart"
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

  return (
    <div className="server-info mx-auto flex w-full max-w-5xl flex-col px-0 pb-2 sm:pb-4">
      <header className="relative h-40 shrink-0 sm:h-44">
        <CurrentTime className="absolute bottom-5 left-0" />
      </header>

      <ServerDetailOverview server_id={serverId} />
      <div className="mt-4">
        <NetworkChart server_id={Number(serverId)} show={true} />
      </div>

    </div>
  )
}
