import { NetworkChart } from "@/components/NetworkChart"
import ServerDetailChart from "@/components/ServerDetailChart"
import ServerDetailOverview from "@/components/ServerDetailOverview"
import TabSwitch from "@/components/TabSwitch"
import { useEffect, useState } from "react"
import { Navigate, useParams } from "react-router-dom"

const DETAIL_TABS = ["Detail", "Network"]

export default function ServerDetail() {
  const { id: serverId } = useParams()
  const [currentTab, setCurrentTab] = useState(DETAIL_TABS[0])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [])

  if (!serverId) {
    return <Navigate to="/404" replace />
  }

  return (
    <div className="server-info mx-auto flex w-full max-w-5xl flex-col gap-4 px-0">
      <ServerDetailOverview server_id={serverId} />
      <section className="flex w-full justify-end py-1">
        <TabSwitch tabs={DETAIL_TABS} currentTab={currentTab} setCurrentTab={setCurrentTab} />
      </section>
      {currentTab === DETAIL_TABS[0] ? (
        <ServerDetailChart server_id={serverId} />
      ) : (
        <NetworkChart server_id={Number(serverId)} show={true} />
      )}
    </div>
  )
}
