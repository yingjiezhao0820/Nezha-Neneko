import { cn } from "@/lib/utils"
import { AnimatePresence, m, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

type CurrentTimeProps = {
  className?: string
}

function formatCurrentTime(time: Date): string {
  return [time.getHours(), time.getMinutes(), time.getSeconds()].map((value) => String(value).padStart(2, "0")).join(":")
}

function RollingDigit({ value }: { value: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <span aria-hidden="true" className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-[-0.08em] leading-none">
      <AnimatePresence initial={false}>
        <m.span
          key={value}
          className="absolute inset-0 flex items-center justify-center"
          initial={reduceMotion ? { y: 0 } : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduceMotion ? { y: 0 } : { y: "-100%" }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  )
}

export default function CurrentTime({ className }: CurrentTimeProps) {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const currentTime = formatCurrentTime(time)

  return (
    <time
      aria-label={currentTime}
      dateTime={currentTime}
      className={cn("inline-flex items-center text-4xl font-medium leading-none tabular-nums sm:text-5xl", className)}
    >
      {currentTime.split("").map((character, index) =>
        character === ":" ? (
          <span aria-hidden="true" className="inline-flex w-[0.55ch] items-center justify-center" key={`separator-${index}`}>
            {character}
          </span>
        ) : (
          <RollingDigit value={character} key={`digit-${index}`} />
        ),
      )}
    </time>
  )
}
