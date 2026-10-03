import { useCallback, useEffect, useState } from "react"
import type { DesktopConnectionStatus, PageAccess, SitePolicy } from "@attention-ui/shared/extension"
import { sendExtensionMessage } from "../../src/communication/messages"
import { sitePattern } from "../../src/control/site-access"

const popupStyle: React.CSSProperties = {
  boxSizing: "border-box", width: 340, padding: 20, color: "#14213d", background: "#fff",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", lineHeight: 1.5
}
const buttonStyle: React.CSSProperties = { padding: "7px 10px", margin: "4px 6px 4px 0", cursor: "pointer" }
export const App = (): React.JSX.Element => {
  const [tabId, setTabId] = useState<number | null>(null)
  const [access, setAccess] = useState<PageAccess | null>(null)
  const [connection, setConnection] = useState<DesktopConnectionStatus>("unknown")
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      setTabId(tab?.id ?? null)
      const [state, status] = await Promise.all([
        tab?.id === undefined ? Promise.resolve(null) : sendExtensionMessage({ type: "GET_TAB_ACCESS", tabId: tab.id }),
        sendExtensionMessage({ type: "GET_CONNECTION_STATUS" })
      ])
      if (state?.ok && "access" in state) setAccess(state.access)
      if (status.ok && "connectionStatus" in status) setConnection(status.connectionStatus)
    } catch { setMessage("无法读取当前标签页，请重新打开弹窗。") }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true); setMessage(null)
    try { await action() } catch { setMessage("操作未完成，请重试。") }
    finally { setBusy(false) }
  }
  async function policy(update: Partial<SitePolicy>): Promise<void> {
    if (tabId === null || !access?.origin) return
    const result = await sendExtensionMessage({ type: "SET_SITE_POLICY", tabId,
      policy: { enabled: access.enabled, autoToolbar: access.autoToolbar, autoAI: access.autoAI, ...update } })
    if (result.ok && "access" in result) setAccess(result.access)
    else if (!result.ok) setMessage(result.message)
  }
  // This call must happen directly in the click handler for Chrome's user gesture.
  function enableSite(): void {
    if (!access?.origin) return
    const grant = chrome.permissions.request({ origins: [sitePattern(access.origin)] })
    void run(async () => {
      if (!await grant) { setMessage("未获得网站授权，AttentionUI 保持关闭。"); return }
      await policy({ enabled: true })
    })
  }
  const supported = Boolean(access?.origin)
  const enabled = Boolean(access?.enabled && access.permission)
  return <main style={popupStyle}>
    <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>AttentionUI</h1>
    <p>桌面端：{connection === "online_paired" ? "在线 · 已配对" : connection === "offline" ? "离线" : connection === "unknown" ? "检测中" : "需要配对"}</p>
    <label><input type="checkbox" checked={access?.globalEnabled ?? true} disabled={busy || !access}
      onChange={event => { const enabled = event.target.checked; void run(async () => {
        const result = await sendExtensionMessage({ type: "UPDATE_EXTENSION_SETTINGS", settings: { enabled } })
        if (!result.ok) setMessage(result.message)
        await refresh()
      }) }} /> 全局启用 AttentionUI</label>
    <hr style={{ border: 0, borderTop: "1px solid #e1e6ee", margin: "16px 0" }} />
    <strong>当前网站</strong>
    <p style={{ margin: "4px 0 8px", overflowWrap: "anywhere" }}>{access?.origin ?? "当前页面暂不支持"}</p>
    {supported ? <>
      <p style={{ fontSize: 12, color: "#536682" }}>启用后可读取本站选区或关注段落。默认仅点击 AI 工具时发送必要片段；不发送整页、网址查询参数和网页标题。</p>
      <button style={buttonStyle} disabled={busy} onClick={() => enabled ? void run(() => policy({ enabled: false })) : enableSite()}>{enabled ? "禁用此网站" : "启用此网站"}</button>
      <label style={{ display: "block", marginTop: 10 }}><input type="checkbox" checked={access?.autoToolbar ?? false} disabled={busy || !enabled}
        onChange={event => { const autoToolbar = event.target.checked; void run(() => policy({ autoToolbar })) }} /> 鼠标停留时自动显示工具条</label>
      <label style={{ display: "block", marginTop: 8 }}><input type="checkbox" checked={access?.autoAI ?? false} disabled={busy || !enabled}
        onChange={event => { const autoAI = event.target.checked; void run(() => policy({ autoAI })) }} /> 自动 AI 工具推荐</label>
      <p style={{ fontSize: 12, color: "#536682" }}>开启自动 AI 推荐后，每次唤起工具条会额外发送当前片段给已配置的 AI，可能产生费用。</p>
      <strong>当前标签页：{access?.paused ? "已暂停" : enabled && access?.globalEnabled ? "可使用" : "未启用"}</strong>
      <div><button style={buttonStyle} disabled={busy || !enabled || !access?.globalEnabled} onClick={() => void run(async () => {
        if (tabId === null || !access) return
        const result = await sendExtensionMessage({ type: "SET_TAB_PAUSED", tabId, paused: !access.paused })
        if (result.ok && "access" in result) setAccess(result.access)
        else if (!result.ok) setMessage(result.message)
      })}>{access?.paused ? "恢复此标签页" : "暂停此标签页"}</button></div>
      <p style={{ fontSize: 12 }}>暂停仅影响此标签页，关闭标签页后结束。</p>
      <button style={buttonStyle} disabled={busy || !access?.active} onClick={() => void run(async () => {
        if (tabId === null) return
        const result = await sendExtensionMessage({ type: "SHOW_SELECTION", tabId })
        if (!result.ok) setMessage(result.message)
        else window.close()
      })}>对选中文字使用工具</button>
      <p style={{ fontSize: 12 }}>也可在正文选字后按 Alt + Shift + F。</p>
    </> : <p>目前支持中英文维基百科、百度百科及本机 Demo。</p>}
    {message && <p role="status" style={{ color: "#a33" }}>{message}</p>}
    <button style={buttonStyle} onClick={() => void chrome.runtime.openOptionsPage()}>连接与设置</button>
  </main>
}
