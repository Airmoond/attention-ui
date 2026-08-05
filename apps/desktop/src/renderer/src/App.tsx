import { useCallback, useEffect, useState } from "react"
import type { AppInfo, AppSettings, ServiceStatus } from "@focus-ui/shared"
import AISettingsPage from "./pages/AISettingsPage"
import BehaviorPage from "./pages/BehaviorPage"
import LogsPage from "./pages/LogsPage"
import StatusPage from "./pages/StatusPage"

type PageId = "status" | "ai" | "behavior" | "logs"

const navigationItems: ReadonlyArray<{ id: PageId; label: string }> = [
  { id: "status", label: "运行状态" },
  { id: "ai", label: "AI设置" },
  { id: "behavior", label: "交互设置" },
  { id: "logs", label: "调试日志" }
]

const App = (): JSX.Element => {
  const [activePage, setActivePage] = useState<PageId>("status")
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isServiceActionPending, setIsServiceActionPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshData = useCallback(async (): Promise<void> => {
    const [nextAppInfo, nextServiceStatus, nextSettings] = await Promise.all([
      window.focusUI.getAppInfo(),
      window.focusUI.getServiceStatus(),
      window.focusUI.getSettings()
    ])

    setAppInfo(nextAppInfo)
    setServiceStatus(nextServiceStatus)
    setSettings(nextSettings)
  }, [])

  useEffect(() => {
    let isActive = true

    const loadInitialData = async (): Promise<void> => {
      try {
        await refreshData()
      } catch (_error: unknown) {
        if (isActive) {
          setErrorMessage("无法读取桌面端状态，请稍后重试。")
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadInitialData()

    return () => {
      isActive = false
    }
  }, [refreshData])

  const updateSettings = async (nextSettings: AppSettings): Promise<void> => {
    setErrorMessage(null)
    const savedSettings = await window.focusUI.updateSettings(nextSettings)
    setSettings(savedSettings)
    const nextAppInfo = await window.focusUI.getAppInfo()
    setAppInfo(nextAppInfo)
  }

  const runServiceAction = async (action: "start" | "stop"): Promise<void> => {
    setIsServiceActionPending(true)
    setErrorMessage(null)

    try {
      const nextStatus =
        action === "start"
          ? await window.focusUI.startService()
          : await window.focusUI.stopService()
      setServiceStatus(nextStatus)
      setAppInfo(await window.focusUI.getAppInfo())

      if (nextStatus.error) {
        setErrorMessage(nextStatus.error)
      }
    } catch (_error: unknown) {
      setErrorMessage(action === "start" ? "本地服务启动失败。" : "本地服务停止失败。")
    } finally {
      setIsServiceActionPending(false)
    }
  }

  const copyServiceAddress = async (): Promise<void> => {
    if (!serviceStatus) {
      return
    }

    try {
      await navigator.clipboard.writeText(serviceStatus.address)
    } catch (_error: unknown) {
      setErrorMessage("无法复制服务地址，请手动复制。")
    }
  }

  const renderPage = (): JSX.Element => {
    if (isLoading) {
      return <section className="page-panel">正在读取桌面端状态…</section>
    }

    if (activePage === "status") {
      return (
        <StatusPage
          appInfo={appInfo}
          serviceStatus={serviceStatus}
          settings={settings}
          isServiceActionPending={isServiceActionPending}
          onStartService={(): Promise<void> => runServiceAction("start")}
          onStopService={(): Promise<void> => runServiceAction("stop")}
          onCopyServiceAddress={copyServiceAddress}
        />
      )
    }

    if (activePage === "ai") {
      return <AISettingsPage settings={settings} onSave={updateSettings} />
    }

    if (activePage === "behavior") {
      return <BehaviorPage settings={settings} onSave={updateSettings} />
    }

    return <LogsPage />
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">FOCUSUI</p>
          <h1>Desktop</h1>
          <p className="sidebar-copy">本地服务与隐私设置</p>
        </div>
        <nav aria-label="主导航">
          {navigationItems.map((item) => (
            <button
              className={activePage === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={(): void => setActivePage(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="content-area">
        {errorMessage ? <p className="notice error">{errorMessage}</p> : null}
        {renderPage()}
      </section>
    </main>
  )
}

export default App
