import { useEffect, useState } from "react"

const HEARTBEAT_INTERVAL_MS = 45_000
const REQUEST_TIMEOUT_MS = 10_000
const VISITOR_ID_STORAGE_KEY = "nezha-neneko:online-visitor-id"

let memoryVisitorId = ""

function createVisitorId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function getVisitorId() {
  try {
    const storedId = localStorage.getItem(VISITOR_ID_STORAGE_KEY)
    if (storedId) return storedId

    const visitorId = createVisitorId()
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId)
    return visitorId
  } catch {
    memoryVisitorId ||= createVisitorId()
    return memoryVisitorId
  }
}

async function sendHeartbeat(visitorId: string, signal: AbortSignal) {
  const response = await fetch(`/api/online/beat?id=${encodeURIComponent(visitorId)}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  })

  if (!response.ok) throw new Error("Failed to send online visitor heartbeat")

  const payload: unknown = await response.json()
  if (!payload || typeof payload !== "object" || !("online" in payload)) {
    throw new Error("Invalid online visitor heartbeat response")
  }

  const online = Number(payload.online)
  if (!Number.isFinite(online)) throw new Error("Invalid online visitor count")

  return Math.max(0, Math.floor(online))
}

export function useOnlineVisitorCount(enabled = true) {
  const [onlineCount, setOnlineCount] = useState<number | null>(null)
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const visitorId = getVisitorId()
    let disposed = false
    let running = false
    let activeController: AbortController | null = null

    const refresh = async () => {
      if (running) return

      running = true
      const controller = new AbortController()
      activeController = controller
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const count = await sendHeartbeat(visitorId, controller.signal)

        if (!disposed) {
          setOnlineCount(count)
          setIsAvailable(true)
        }
      } catch {
        if (!disposed) setIsAvailable(false)
      } finally {
        window.clearTimeout(timeout)
        if (activeController === controller) activeController = null
        running = false
      }
    }

    void refresh()
    const interval = window.setInterval(() => void refresh(), HEARTBEAT_INTERVAL_MS)

    return () => {
      disposed = true
      window.clearInterval(interval)
      activeController?.abort()
    }
  }, [enabled])

  return { onlineCount, isAvailable }
}
