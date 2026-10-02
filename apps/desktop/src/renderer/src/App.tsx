import { useCallback, useEffect, useState } from "react"
import type { AppInfo, AppSettings, PairingStatus, ServiceStatus } from "@focus-ui/shared"
import AISettingsPage from "./pages/AISettingsPage"
import BehaviorPage from "./pages/BehaviorPage"
import LogsPage from "./pages/LogsPage"
import QuickStartPage from "./pages/QuickStartPage"
import StatusPage from "./pages/StatusPage"

type PageId = "quickstart" | "status" | "ai" | "behavior" | "logs"

const navigationItems: ReadonlyArray<{ id: PageId; label: string }> = [
  { id: "quickstart", label: "快速上手" },
  { id: "status", label: "运行状态" },
  { id: "ai", label: "AI设置" },
  { id: "behavior", label: "交互设置" },
  { id: "logs", label: "调试日志" }
]

const App = (): JSX.Element => {
  const [activePage, setActivePage] = useState<PageId>("quickstart")
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [pairingStatus, setPairingStatus] = useState<PairingStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isServiceActionPending, setIsServiceActionPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshData = useCallback(async (): Promise<void> => {
    const [nextAppInfo, nextServiceStatus, nextSettings, nextPairingStatus] = await Promise.all([
      window.focusUI.getAppInfo(),
      window.focusUI.getServiceStatus(),
      window.focusUI.getSettings(),
      window.focusUI.getPairingStatus()
    ])

    setAppInfo(nextAppInfo)
    setServiceStatus(nextServiceStatus)
    setSettings(nextSettings)
    setPairingStatus(nextPairingStatus)
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

  useEffect(() => {
    let isActive = true

    const refreshPairingStatus = async (): Promise<void> => {
      try {
        const nextPairingStatus = await window.focusUI.getPairingStatus()
        if (isActive) {
          setPairingStatus(nextPairingStatus)
        }
      } catch (_error: unknown) {
        if (isActive) {
          setErrorMessage("无法刷新插件配对状态，请稍后重试。")
        }
      }
    }

    const refreshIntervalId = window.setInterval(() => {
      void refreshPairingStatus()
    }, 2000)

    return () => {
      isActive = false
      window.clearInterval(refreshIntervalId)
    }
  }, [])

  const updateSettings = async (nextSettings: AppSettings): Promise<void> => {
    setErrorMessage(null)
    const savedSettings = await window.focusUI.updateSettings(nextSettings)
    setSettings(savedSettings)
    const nextAppInfo = await window.focusUI.getAppInfo()
    setAppInfo(nextAppInfo)
  }

  const resetPreferences = async (): Promise<void> => {
    await window.focusUI.resetPreferences()
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

  const copyPairingToken = async (): Promise<void> => {
    if (!pairingStatus) {
      return
    }

    try {
      await navigator.clipboard.writeText(pairingStatus.pairingToken)
    } catch (_error: unknown) {
      setErrorMessage("无法复制配对令牌，请手动复制。")
    }
  }

  const runPairingAction = async (action: "regenerate" | "disconnect"): Promise<void> => {
    setErrorMessage(null)
    try {
      const nextPairingStatus =
        action === "regenerate"
          ? await window.focusUI.regeneratePairingToken()
          : await window.focusUI.disconnectPlugin()
      setPairingStatus(nextPairingStatus)
    } catch (_error: unknown) {
      setErrorMessage(action === "regenerate" ? "无法重新生成配对令牌。" : "无法断开插件。")
    }
  }

  const renderPage = (): JSX.Element => {
    if (isLoading) {
      return <section className="page-panel">正在读取桌面端状态…</section>
    }

    if (activePage === "quickstart") {
      return (
        <QuickStartPage
          appInfo={appInfo}
          serviceStatus={serviceStatus}
          pairingStatus={pairingStatus}
          onOpenGuide={window.focusUI.openQuickStart}
          onPrepareExtension={window.focusUI.prepareExtensionInstall}
          onOpenArticleDemo={window.focusUI.openArticleDemo}
          onOpenFinanceDemo={window.focusUI.openFinanceDemo}
          onCopyPairingToken={copyPairingToken}
          onOpenAiSettings={(): void => setActivePage("ai")}
        />
      )
    }

    if (activePage === "status") {
      return (
        <StatusPage
          appInfo={appInfo}
          serviceStatus={serviceStatus}
          settings={settings}
          pairingStatus={pairingStatus}
          isServiceActionPending={isServiceActionPending}
          onStartService={(): Promise<void> => runServiceAction("start")}
          onStopService={(): Promise<void> => runServiceAction("stop")}
          onCopyServiceAddress={copyServiceAddress}
          onCopyPairingToken={copyPairingToken}
          onRegeneratePairingToken={(): Promise<void> => runPairingAction("regenerate")}
          onDisconnectPlugin={(): Promise<void> => runPairingAction("disconnect")}
        />
      )
    }

    if (activePage === "ai") {
      return <AISettingsPage settings={settings} onSave={updateSettings} />
    }

    if (activePage === "behavior") {
      return (
        <BehaviorPage
          settings={settings}
          onSave={updateSettings}
          onResetPreferences={resetPreferences}
        />
      )
    }

    return <LogsPage />
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">FOCUSUI 0.1.1 学生测试版</p>
          <h1>Desktop</h1>
          <p className="sidebar-copy">本地AI服务与新手引导</p>
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
