import { Skeleton } from "@/components/ui/skeleton"

export function ServerDetailChartLoading() {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-[182px] w-full animate-none rounded-lg bg-white/10" />
      ))}
    </section>
  )
}

export function ServerDetailLoading() {
  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl border border-white/10 px-5 py-4 backdrop-blur-md sm:px-6">
        <Skeleton className="h-6 w-36 animate-none bg-white/10" />
        <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="space-y-2" key={index}>
              <Skeleton className="h-2.5 w-12 animate-none bg-white/10" />
              <Skeleton className="h-3 w-20 animate-none bg-white/10" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-12 w-full animate-none bg-white/10" />
      </section>
      <section className="glass-card grid grid-cols-2 overflow-hidden rounded-lg border border-white/10 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-[68px] animate-none rounded-none border-r border-white/10 bg-white/5" />
        ))}
      </section>
    </div>
  )
}
