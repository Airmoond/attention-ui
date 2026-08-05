import { useEffect, useState } from "react"
import type { AppInfo } from "@focus-ui/shared"

const App = (): JSX.Element => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadAppInfo = async (): Promise<void> => {
      try {
        const nextAppInfo = await window.focusUI.getAppInfo()

        if (isActive) {
          setAppInfo(nextAppInfo)
        }
      } catch (error: unknown) {
        console.error("Failed to load FocusUI app information.", error)

        if (isActive) {
          setLoadError(true)
        }
      }
    }

    void loadAppInfo()

    return () => {
      isActive = false
    }
  }, [])

  return (
    <main>
      <h1>FocusUI Desktop</h1>
      <p>
        本地服务：
        {appInfo ? (appInfo.serviceRunning ? "运行中" : "尚未启动") : "读取中"}
      </p>
      {appInfo ? (
        <>
          <p>应用版本：{appInfo.version}</p>
          <p>当前平台：{appInfo.platform}</p>
        </>
      ) : null}
      {loadError ? <p>无法读取应用信息。</p> : null}
    </main>
  )
}

export default App
