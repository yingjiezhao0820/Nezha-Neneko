const RPC_ENDPOINT = "/api/rpc2"
const DEDUPE_WINDOW_MS = 2_500

const FIELD_LIMITS = {
  event: 64,
  path: 512,
  route: 128,
  target: 128,
  ref: 512,
} as const

type VisitorEventParams = {
  event: "page_view"
  path: string
  route: string
  target: string
  detail?: {
    ref?: string
  }
}

type RecentEvent = {
  key: string
  time: number
}

let requestId = 0
let lastReportedPath = ""
let recentEvent: RecentEvent | null = null

function truncate(value: string, maxLength: number) {
  return Array.from(value).slice(0, maxLength).join("")
}

function normalizePath(path: string) {
  const normalized = path.trim() || "/"
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

function isManagementPath(path: string) {
  const normalized = path.toLowerCase().replace(/\/+$/, "") || "/"
  return ["/admin", "/api/admin", "/dashboard", "/manage", "/management"].some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

function createPayload(params: VisitorEventParams) {
  const ref = params.detail?.ref?.trim()

  return JSON.stringify({
    jsonrpc: "2.0",
    method: "public:recordVisitorEvent",
    params: {
      event: truncate(params.event.toLowerCase().replace(/\s+/g, "_"), FIELD_LIMITS.event),
      path: truncate(params.path, FIELD_LIMITS.path),
      route: truncate(params.route, FIELD_LIMITS.route),
      target: truncate(params.target, FIELD_LIMITS.target),
      ...(ref
        ? {
            detail: {
              ref: truncate(ref, FIELD_LIMITS.ref),
            },
          }
        : {}),
    },
    id: ++requestId,
  })
}

export function recordVisitorPageView(input: Omit<VisitorEventParams, "event">) {
  const path = normalizePath(input.path)

  if (isManagementPath(path) || path === lastReportedPath) return

  const now = Date.now()
  const eventKey = `page_view:${path}`
  if (recentEvent?.key === eventKey && now - recentEvent.time < DEDUPE_WINDOW_MS) return

  lastReportedPath = path
  recentEvent = { key: eventKey, time: now }

  const body = createPayload({ ...input, event: "page_view", path })

  if (document.visibilityState === "hidden" && typeof navigator.sendBeacon === "function") {
    try {
      navigator.sendBeacon(RPC_ENDPOINT, new Blob([body], { type: "application/json" }))
      return
    } catch {
      // Fall through to the silent fire-and-forget request.
    }
  }

  void fetch(RPC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined)
}
