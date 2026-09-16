import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

type CurrentTimeProps = {
  className?: string
}

function formatCurrentTime(time: Date): string {
  return [time.getHours(), time.getMinutes(), time.getSeconds()].map((value) => String(value).padStart(2, "0")).join(":")
}

export default function CurrentTime({ className }: CurrentTimeProps) {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <time className={cn("text-4xl font-medium tracking-wide tabular-nums sm:text-5xl", className)}>{formatCurrentTime(time)}</time>
}
