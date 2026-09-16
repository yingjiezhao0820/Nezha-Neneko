import { SharedClient } from "@/hooks/use-rpc2"
import { getKomariNodes, komariToNezhaWebsocketResponse } from "@/lib/utils"
import { NezhaWebsocketResponse } from "@/types/nezha-api"
import React, { useEffect, useRef, useState } from "react"

import { WebSocketContext, WebSocketContextType } from "./websocket-context"

interface WebSocketProviderProps {
  url: string
  children: React.ReactNode
}

const SNAPSHOT_CACHE_KEY = "komari:last-status-snapshot"
const SNAPSHOT_MAX_AGE = 5 * 60 * 1000

function readCachedSnapshot(): NezhaWebsocketResponse | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_CACHE_KEY)
    if (!raw) return null

    const snapshot = JSON.parse(raw) as NezhaWebsocketResponse
    if (!Number.isFinite(snapshot.now) || !Array.isArray(snapshot.servers) || Date.now() - snapshot.now > SNAPSHOT_MAX_AGE) {
      sessionStorage.removeItem(SNAPSHOT_CACHE_KEY)
      return null
    }

    return snapshot
  } catch {
    sessionStorage.removeItem(SNAPSHOT_CACHE_KEY)
    return null
  }
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const cachedSnapshot = useRef<NezhaWebsocketResponse | null>(readCachedSnapshot())
  const [lastMessage, setLastMessage] = useState<NezhaWebsocketResponse | null>(cachedSnapshot.current)
  const [messageHistory, setMessageHistory] = useState<NezhaWebsocketResponse[]>(() =>
    cachedSnapshot.current ? [cachedSnapshot.current] : [],
  )
  const [connected, setConnected] = useState(false)
  const [needReconnect, setNeedReconnect] = useState(false)
  const requestInFlight = useRef(false)

  useEffect(() => {
    let disposed = false

    const getData = async () => {
      if (requestInFlight.current) return
      requestInFlight.current = true

      try {
        const rpc2 = SharedClient()
        // 节点元数据与实时状态并行获取，但首屏必须等待两者就绪。
        // 旧实现会在元数据尚未写入缓存时先渲染空表格，再等 2 秒轮询。
        const [nodes, latestStatus] = await Promise.all([getKomariNodes(), rpc2.call("common:getNodesLatestStatus")])
        const nextSnapshot = komariToNezhaWebsocketResponse(latestStatus, nodes)

        if (disposed) return

        setLastMessage(nextSnapshot)
        setMessageHistory((previous) => [nextSnapshot, ...previous].slice(0, 30))
        setConnected(true)
        setNeedReconnect(false)
        sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(nextSnapshot))
      } catch (error) {
        if (!disposed) {
          setNeedReconnect(true)
          console.warn("getNodesLatestStatus 失败，等待下一轮:", error instanceof Error ? error.message : error)
        }
      } finally {
        requestInFlight.current = false
      }
    }

    void getData()
    const interval = window.setInterval(() => void getData(), 2000)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [])

  const reconnect = () => {
    setNeedReconnect(true)
  }

  const contextValue: WebSocketContextType = {
    lastMessage,
    connected,
    messageHistory,
    reconnect,
    needReconnect,
    setNeedReconnect,
  }

  return <WebSocketContext.Provider value={contextValue}>{children}</WebSocketContext.Provider>
}
