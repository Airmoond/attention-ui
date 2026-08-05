import { useEffect, useState } from "react"
import type { ExtensionSettings } from "@focus-ui/shared/extension"
import { sendExtensionMessage } from "../../src/communication/messages"

const pageStyle: React.CSSProperties = {
  maxWidth: 640,
  margin: "48px auto",
  padding: "0 24px",
  color: "#14213d",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 8,
  padding: 10,
  border: "1px solid #aeb8c7",
  borderRadius: 6
}

export const App = (): React.JSX.Element => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [desktopBaseUrl, setDesktopBaseUrl] = useState("http://127.0.0.1:17321")
  const [pairingToken, setPairingToken] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [connectionLabel, setConnectionLabel] = useState("未检测")

  useEffect(() => {
    void (async (): Promise<void> => {
      const [settingsResult, statusResult] = await Promise.all([
        sendExtensionMessage({ type: "GET_EXTENSION_SETTINGS" }),
        sendExtensionMessage({ type: "GET_CONNECTION_STATUS" })
      ])
      if (settingsResult.ok && "settings" in settingsResult) {
        setSettings(settingsResult.settings)
        setDesktopBaseUrl(settingsResult.settings.desktopBaseUrl)
      }
      if (statusResult.ok && "connectionStatus" in statusResult) {
        setConnectionLabel(
          statusResult.connectionStatus === "online_paired"
            ? "已配对"
            : statusResult.connectionStatus === "auth_expired"
              ? "令牌已失效，需要重新配对"
              : statusResult.connectionStatus === "offline"
                ? "桌面端离线"
                : "尚未配对"
        )
        setStatusMessage(statusResult.message)
      }
    })()
  }, [])

  const saveSettings = async (): Promise<void> => {
    try {
      const result = await sendExtensionMessage({
        type: "UPDATE_EXTENSION_SETTINGS",
        settings: {
          desktopBaseUrl: desktopBaseUrl as ExtensionSettings["desktopBaseUrl"],
          enabled: settings?.enabled ?? true
        }
      })
      if (!result.ok || !("settings" in result)) {
        setStatusMessage(result.ok ? "设置保存失败" : result.message)
        return
      }
      setSettings(result.settings)
      setDesktopBaseUrl(result.settings.desktopBaseUrl)
      setStatusMessage("设置已保存")
    } catch (error: unknown) {
      setStatusMessage(error instanceof Error ? error.message : "设置保存失败")
    }
  }

  const updateEnabled = async (enabled: boolean): Promise<void> => {
    const result = await sendExtensionMessage({ type: "UPDATE_EXTENSION_SETTINGS", settings: { enabled } })
    if (result.ok && "settings" in result) {
      setSettings(result.settings)
      return
    }
    setStatusMessage(result.ok ? "设置保存失败" : result.message)
  }

  const pair = async (): Promise<void> => {
    const result = await sendExtensionMessage({ type: "PAIR_DESKTOP", pairingToken })
    if (result.ok && "connectionStatus" in result) {
      setConnectionLabel(result.connectionStatus === "online_paired" ? "已配对" : "需要重新配对")
      setStatusMessage(result.message ?? (result.connectionStatus === "online_paired" ? "配对成功" : null))
      if (result.connectionStatus === "online_paired") {
        setPairingToken("")
      }
      return
    }
    setStatusMessage(result.ok ? "配对失败" : result.message)
  }

  const clearLocalPairing = async (): Promise<void> => {
    const result = await sendExtensionMessage({ type: "CLEAR_LOCAL_PAIRING" })
    if (result.ok && "settings" in result) {
      setSettings(result.settings)
      setConnectionLabel("尚未配对")
      setStatusMessage("已清除本地配对状态")
      return
    }
    setStatusMessage(result.ok ? "清除本地配对状态失败" : result.message)
  }

  return (
    <main style={pageStyle}>
      <h1>FocusUI 设置</h1>
      <label>
        桌面服务地址
        <input
          style={fieldStyle}
          value={desktopBaseUrl}
          onChange={(event) => setDesktopBaseUrl(event.target.value)}
        />
      </label>
      <button type="button" style={{ marginTop: 12, padding: "10px 14px" }} onClick={() => void saveSettings()}>
        保存服务地址
      </button>
      <label style={{ display: "block", marginTop: 18 }}>
        配对令牌
        <input
          style={fieldStyle}
          value={pairingToken}
          onChange={(event) => setPairingToken(event.target.value)}
          placeholder="输入桌面端显示的配对令牌"
        />
      </label>
      <button type="button" style={{ marginTop: 18, padding: "10px 14px" }} onClick={() => void pair()}>
        连接桌面端
      </button>
      <button type="button" style={{ marginLeft: 12, padding: "10px 14px" }} onClick={() => void clearLocalPairing()}>
        断开配对
      </button>
      <p>当前配对状态：{connectionLabel}</p>
      {statusMessage ? <p role="status">{statusMessage}</p> : null}
      <label>
        <input
          type="checkbox"
          checked={settings?.enabled ?? true}
          onChange={(event) => void updateEnabled(event.target.checked)}
        />{" "}
        启用 FocusUI
      </label>
    </main>
  )
}
