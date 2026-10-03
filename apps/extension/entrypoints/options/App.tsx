import { useEffect, useState } from "react"
import type { ExtensionSettings } from "@attention-ui/shared/extension"
import { sendExtensionMessage } from "../../src/communication/messages"
import { Icon } from "../../src/ui/Icon"
import "../../src/ui/settings.css"

export const App = (): React.JSX.Element => {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null)
  const [desktopBaseUrl, setDesktopBaseUrl] = useState("http://127.0.0.1:17321")
  const [pairingToken, setPairingToken] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("info")
  const [connectionLabel, setConnectionLabel] = useState("检测中")
  const [busy, setBusy] = useState(true)
  const [action, setAction] = useState<string | null>(null)

  const report = (message: string, ok: boolean): void => {
    setStatusMessage(message)
    setMessageKind(ok ? "success" : "error")
  }

  useEffect(() => {
    let active = true
    void (async (): Promise<void> => {
      try {
        const [settingsResult, statusResult] = await Promise.all([
          sendExtensionMessage({ type: "GET_EXTENSION_SETTINGS" }),
          sendExtensionMessage({ type: "GET_CONNECTION_STATUS" })
        ])
        if (!active) return
        if (settingsResult.ok && "settings" in settingsResult) {
          setSettings(settingsResult.settings)
          setDesktopBaseUrl(settingsResult.settings.desktopBaseUrl)
        } else if (!settingsResult.ok) report(settingsResult.message, false)
        if (statusResult.ok && "connectionStatus" in statusResult) {
          setConnectionLabel(statusResult.connectionStatus === "online_paired" ? "已配对" : statusResult.connectionStatus === "auth_expired" ? "配对已失效" : statusResult.connectionStatus === "offline" ? "桌面端离线" : "尚未配对")
        } else if (!statusResult.ok) report(statusResult.message, false)
      } catch (_error: unknown) {
        if (active) report("无法读取连接状态，请重新打开设置页。", false)
      } finally { if (active) setBusy(false) }
    })()
    return () => { active = false }
  }, [])

  const run = async (name: string, operation: () => Promise<void>): Promise<void> => {
    setBusy(true); setAction(name); setStatusMessage(null)
    try { await operation() }
    catch (_error: unknown) { report("操作未完成，请稍后重试。", false) }
    finally { setBusy(false); setAction(null) }
  }
  const saveSettings = async (): Promise<void> => {
    const result = await sendExtensionMessage({ type: "UPDATE_EXTENSION_SETTINGS", settings: {
      desktopBaseUrl: desktopBaseUrl as ExtensionSettings["desktopBaseUrl"], enabled: settings?.enabled ?? true
    } })
    if (result.ok && "settings" in result) {
      setSettings(result.settings); setDesktopBaseUrl(result.settings.desktopBaseUrl)
      report("服务地址已保存。", true)
    } else report(result.ok ? "设置保存失败" : result.message, false)
  }
  const pair = async (): Promise<void> => {
    const result = await sendExtensionMessage({ type: "PAIR_DESKTOP", pairingToken })
    if (result.ok && "connectionStatus" in result) {
      const paired = result.connectionStatus === "online_paired"
      setConnectionLabel(paired ? "已配对" : "需要重新配对")
      report(result.message ?? (paired ? "配对成功。" : "配对未完成，请重试。"), paired)
      if (paired) setPairingToken("")
    } else report(result.ok ? "配对失败" : result.message, false)
  }
  const clearLocalPairing = async (): Promise<void> => {
    const result = await sendExtensionMessage({ type: "CLEAR_LOCAL_PAIRING" })
    if (result.ok && "settings" in result) {
      setSettings(result.settings); setConnectionLabel("尚未配对")
      report("已清除本地配对状态。", true)
    } else report(result.ok ? "清除本地配对状态失败" : result.message, false)
  }
  const updateEnabled = async (enabled: boolean): Promise<void> => {
    const result = await sendExtensionMessage({ type: "UPDATE_EXTENSION_SETTINGS", settings: { enabled } })
    if (result.ok && "settings" in result) {
      setSettings(result.settings); report(enabled ? "AttentionUI 已启用。" : "AttentionUI 已关闭。", true)
    } else report(result.ok ? "设置保存失败" : result.message, false)
  }

  return <main className="aui-options" aria-busy={busy}>
    <header><div className="aui-brand"><span className="aui-brand-mark"><Icon name="spark" /></span><div><h1>AttentionUI</h1><p>阅读工具，随时在身边</p></div></div></header>
    <h2>连接与设置</h2>
    <p className="aui-options-intro">连接本机桌面端，开始使用 AI 阅读工具。</p>
    <div className="aui-connection" role="status"><span className={connectionLabel === "已配对" ? "aui-dot connected" : "aui-dot"} />当前配对状态：{connectionLabel}</div>
    <section className="aui-settings-group"><h3>桌面连接</h3>
      <label className="aui-field"><span>桌面服务地址</span><input aria-label="桌面服务地址" disabled={busy} spellCheck={false} autoComplete="off" value={desktopBaseUrl} onChange={event => setDesktopBaseUrl(event.target.value)} /><small>桌面端默认运行在本机地址 127.0.0.1:17321。</small></label>
      <button className="aui-button secondary" disabled={busy} onClick={() => void run("save", saveSettings)}>{action === "save" ? "保存中…" : "保存服务地址"}</button>
    </section>
    <section className="aui-settings-group"><h3>插件配对</h3>
      <label className="aui-field"><span>配对令牌</span><input aria-label="配对令牌" disabled={busy} value={pairingToken} spellCheck={false} autoComplete="off" placeholder="输入桌面端显示的配对令牌" onChange={event => setPairingToken(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && pairingToken.trim() && !busy) void run("pair", pair) }} /><small>在桌面端“快速上手”或“运行状态”中复制令牌。</small></label>
      <div className="aui-options-actions"><button className="aui-button" disabled={busy || !pairingToken.trim()} onClick={() => void run("pair", pair)}>{action === "pair" ? "连接中…" : "连接桌面端"}</button><button className="aui-button secondary" disabled={busy || connectionLabel === "尚未配对"} onClick={() => void run("disconnect", clearLocalPairing)}>断开配对</button></div>
    </section>
    {statusMessage ? <p role="status" className={`aui-notice ${messageKind}`}>{statusMessage}</p> : null}
    <section className="aui-settings-group"><label className="aui-switch-row"><span className="aui-switch-copy"><strong>启用 AttentionUI</strong><small>启用后，在插件弹窗中管理各网站。</small></span><input aria-label="启用 AttentionUI" type="checkbox" disabled={busy || !settings} checked={settings?.enabled ?? true} onChange={event => { const enabled = event.target.checked; void run("enabled", () => updateEnabled(enabled)) }} /></label></section>
    <p className="aui-hint"><Icon name="shield" /> API Key 在桌面端配置，浏览器插件仅保存配对信息。</p>
  </main>
}
