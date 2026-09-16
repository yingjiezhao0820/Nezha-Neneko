import { recordVisitorPageView } from "@/utils/visitorAudit"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

function resolveRoute(pathname: string) {
  if (pathname === "/") {
    return { route: "/", target: "home" }
  }

  if (/^\/server\/[^/]+\/?$/.test(pathname)) {
    return { route: "/server/:id", target: "server_detail" }
  }

  if (pathname === "/error") {
    return { route: "/error", target: "error" }
  }

  return { route: "*", target: "not_found" }
}

export default function VisitorAuditReporter() {
  const location = useLocation()

  useEffect(() => {
    const path = window.location.pathname
    const { route, target } = resolveRoute(location.pathname)

    recordVisitorPageView({
      path,
      route,
      target,
      detail: document.referrer ? { ref: document.referrer } : undefined,
    })
  }, [location.pathname])

  return null
}
