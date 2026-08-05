import { useCallback, useEffect, useState } from "react"
import type { DesktopConnectionStatus } from "@focus-ui/shared/extension"
import { sendExtensionMessage } from "../../src/communication/messages"

const popupStyle: React.CSSProperties = {
  boxSizing: "border-box",
  width: 280,
  minHeight: 160,
  padding: 20,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  color: "#14213d",
  background: "#ffffff"
}

export const App = (): React.JSX.Element => {
  const [enabled, setEnabled] = useState(true)
  const [connectionStatus, setConnectionStatus] = useState<DesktopConnectionStatus>("unknown")
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const [settingsResult, statusResult] = await Promise.all([
      sendExtensionMessage({ type: "GET_EXTENSION_SETTINGS" }),
      sendExtensionMessage({ type: "CHECK_DESKTOP_HEALTH" })
    ])
    if (settingsResult.ok && "settings" in settingsResult) {
      setEnabled(settingsResult.settings.enabled)
    }
    if (statusResult.ok && "connectionStatus" in statusResult) {
      setConnectionStatus(statusResult.connectionStatus)
      setMessage(statusResult.message)
      return
    }
    setConnectionStatus("unknown")
    setMessage(statusResult.ok ? "桌面端状态未知" : statusResult.message)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const desktopLabel = connectionStatus === "offline" ? "离线" : connectionStatus === "unknown" ? "未检测" : "在线"
  const pairingLabel =
    connectionStatus === "online_paired"
      ? "已配对"
      : connectionStatus === "auth_expired"
        ? "已失效，需要重新配对"
        : "未配对"

  return (
    <main style={popupStyle}>
      <h1 style={{ margin: "0 0 18px", fontSize: 22 }}>FocusUI</h1>
      <p style={{ margin: "0 0 10px" }}>桌面端：{desktopLabel}</p>
      <p style={{ margin: "0 0 10px" }}>配对：{pairingLabel}</p>
      <p style={{ margin: "0 0 10px" }}>当前页面：{enabled ? "已启用" : "已禁用"}</p>
      {message ? <p role="status">{message}</p> : null}
      <button type="button" onClick={() => void refresh()}>
        重新检测
      </button>
    </main>
  )
}
