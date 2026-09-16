import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNavigate } from "react-router-dom"

import { BackIcon } from "../Icon"

export function ServerDetailChartLoading() {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-[182px] w-full animate-none rounded-lg bg-muted-foreground/10" />
      ))}
    </section>
  )
}

export function ServerDetailLoading() {
  const navigate = useNavigate()

  return (
    <Card className="w-full overflow-hidden rounded-xl border-border/70 shadow-sm">
      <div className="p-4 sm:p-5">
        <button type="button" onClick={() => navigate("/")} className="flex items-center gap-1.5">
          <BackIcon />
          <Skeleton className="h-5 w-28 animate-none rounded bg-muted-foreground/10" />
        </button>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="space-y-2" key={index}>
              <Skeleton className="h-2.5 w-12 animate-none bg-muted-foreground/10" />
              <Skeleton className="h-3 w-20 animate-none bg-muted-foreground/10" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-14 w-full animate-none rounded-lg bg-muted-foreground/10" />
      </div>
      <div className="grid grid-cols-2 border-t sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[70px] animate-none rounded-none border-r bg-muted-foreground/5" />
        ))}
      </div>
    </Card>
  )
}
