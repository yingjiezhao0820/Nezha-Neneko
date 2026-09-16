import { ASSET_SUMMARY_OPEN_EVENT } from "@/components/AssetSummaryWidget"
import CurrentTime from "@/components/CurrentTime"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useWebSocketContext } from "@/hooks/use-websocket-context"
import { fetchSetting } from "@/lib/nezha-api"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, m } from "framer-motion"
import { CircleDollarSign, LogIn } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { LanguageSwitcher } from "./LanguageSwitcher"
import { LoadingSpinner } from "./loading/Loader"
import { Button } from "./ui/button"

function Header() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: settingData, isLoading } = useQuery({
    queryKey: ["setting"],
    queryFn: () => fetchSetting(),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  //const { lastMessage, connected } = useWebSocketContext()

  //const onlineCount = connected ? (lastMessage ? JSON.parse(lastMessage.data).online || 0 : 0) : "..."

  const siteName = settingData?.data?.config?.site_name

  // @ts-expect-error CustomLogo is a global variable
  const customLogo = window.CustomLogo || "/favicon.ico"

  const customDesc = settingData?.data?.config?.site_desc || (window as any).CustomDesc || "Komari Monitor"
  const showAssetCard = (window as unknown as Record<string, unknown>).ShowAssetCard === true

  useEffect(() => {
    const link = document.querySelector("link[rel*='icon']") || document.createElement("link")
    // @ts-expect-error set link.type
    link.type = "image/x-icon"
    // @ts-expect-error set link.rel
    link.rel = "shortcut icon"
    // @ts-expect-error set link.href
    link.href = customLogo
    document.getElementsByTagName("head")[0].appendChild(link)
  }, [customLogo])

  // useEffect(() => {
  //   document.title = siteName || "哪吒监控 Nezha Monitoring"
  // }, [siteName])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <section className="flex items-center justify-between header-top">
        <section
          onClick={() => {
            sessionStorage.removeItem("selectedGroup")
            navigate("/")
          }}
          className="cursor-pointer flex items-center sm:text-base text-sm font-medium"
        >
          <div className="mr-1 flex flex-row items-center justify-start header-logo">
            <img
              width={40}
              height={40}
              alt="apple-touch-icon"
              src={customLogo}
              className="relative m-0! border-2 border-transparent h-6 w-6 object-cover object-top p-0!"
            />
          </div>
          {isLoading ? <Skeleton className="h-6 w-20 rounded-[5px] bg-muted-foreground/10 animate-none" /> : siteName || "NEZHA"}
          <Separator orientation="vertical" className="mx-2 hidden h-4 w-[1px] md:block" />
          <p className="hidden text-sm font-medium opacity-40 md:block">{customDesc}</p>
        </section>
        <section className="flex items-center gap-2 header-handles">
          <div className="hidden sm:flex items-center gap-2">
            <Links />
            <DashboardLink />
          </div>
          {showAssetCard && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="glass-card glass-card-interactive rounded-full border-white/10 px-[9px] text-white shadow-none backdrop-blur-md hover:text-white"
              aria-label="打开资产统计"
              title="资产统计"
              onClick={() => window.dispatchEvent(new Event(ASSET_SUMMARY_OPEN_EVENT))}
            >
              <CircleDollarSign className="size-4" />
            </Button>
          )}
          <LanguageSwitcher />
          <a href="/admin" target="_blank" rel="noreferrer">
            <Button
              variant="outline"
              size="sm"
              className="glass-card glass-card-interactive rounded-full border-white/10 px-[9px] text-white shadow-none backdrop-blur-md hover:text-white"
              title={t("login")}
            >
              <LogIn className="size-4" />
            </Button>
          </a>
        </section>
      </section>
      <div className="w-full flex justify-between sm:hidden mt-1">
        <DashboardLink />
        <Links />
      </div>
      <Overview />
    </div>
  )
}

type links = {
  link: string
  name: string
}

function Links() {
  // @ts-expect-error CustomLinks is a global variable
  const customLinks = window.CustomLinks as string

  const links: links[] | null = customLinks ? JSON.parse(customLinks) : null

  if (!links) return null

  return (
    <div className="flex items-center gap-2 w-fit">
      {links.map((link, index) => {
        return (
          <a
            key={index}
            href={link.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
          >
            {link.name}
          </a>
        )
      })}
    </div>
  )
}

export function RefreshToast() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { needReconnect } = useWebSocketContext()

  if (!needReconnect) {
    return null
  }

  if (needReconnect) {
    sessionStorage.removeItem("needRefresh")
    setTimeout(() => {
      navigate(0)
    }, 1000)
  }

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0, filter: "blur(10px)", scale: 0.8 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        exit={{ opacity: 0, filter: "blur(10px)", scale: 0.8 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="fixed left-1/2 -translate-x-1/2 top-8 z-[999] flex items-center justify-between gap-4 rounded-[50px] border-[1px] border-solid bg-white px-2 py-1.5 shadow-xl shadow-black/5 dark:border-stone-700 dark:bg-stone-800 dark:shadow-none"
      >
        <section className="flex items-center gap-1.5">
          <LoadingSpinner />
          <p className="text-[12.5px] font-medium">{t("refreshing")}...</p>
        </section>
      </m.div>
    </AnimatePresence>
  )
}

function DashboardLink() {
  // 登录交给Komari后台处理
  // const { t } = useTranslation()
  // const { setNeedReconnect } = useWebSocketContext()
  // const previousLoginState = useRef<boolean | null>(null)
  // const {
  //   data: userData,
  //   isFetched,
  //   isLoadingError,
  //   isError,
  //   refetch,
  // } = useQuery({
  //   queryKey: ["login-user"],
  //   queryFn: () => fetchLoginUser(),
  //   refetchOnMount: false,
  //   refetchOnWindowFocus: true,
  //   refetchIntervalInBackground: true,
  //   refetchInterval: 1000 * 30,
  //   retry: 0,
  // })

  // const isLogin = isError ? false : userData ? !!userData?.data?.id && !!document.cookie : false

  // if (isLoadingError) {
  //   previousLoginState.current = isLogin
  // }

  // useEffect(() => {
  //   refetch()
  // }, [document.cookie])

  // useEffect(() => {
  //   if (isFetched || isError) {
  //     // 只有当登录状态发生变化时才设置needReconnect
  //     if (previousLoginState.current !== null && previousLoginState.current !== isLogin) {
  //       setNeedReconnect(true)
  //     }
  //     previousLoginState.current = isLogin
  //   }
  // }, [isLogin])

  return (
    <></>
    // <div className="flex items-center gap-2">
    //   <a
    //     href={"/dashboard"}
    //     rel="noopener noreferrer"
    //     className="flex items-center text-nowrap gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
    //   >
    //     {!isLogin && t("login")}
    //     {isLogin && t("dashboard")}
    //   </a>
    // </div>
  )
}

function Overview() {
  return (
    <section className="mt-10 flex flex-col md:mt-16 header-timer">
      <CurrentTime />
    </section>
  )
}
export default Header
