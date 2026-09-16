import { Loader } from "@/components/loading/Loader"
import { Skeleton } from "@/components/ui/skeleton"

export default function NetworkChartLoading() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/45 backdrop-blur-md">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div className="-mr-px space-y-2 border-b border-r border-white/10 px-4 py-3" key={index}>
            <Skeleton className="h-2.5 w-20 animate-none bg-white/10" />
            <Skeleton className="h-4 w-14 animate-none bg-white/10" />
          </div>
        ))}
      </div>
      <div className="flex h-[310px] items-center justify-center border-t border-white/10">
        <Loader visible={true} />
      </div>
    </section>
  )
}
