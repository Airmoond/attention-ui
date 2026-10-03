import { useCallback, useEffect, useState } from "react"
import type { DesktopConnectionStatus, PageAccess, SitePolicy } from "@attention-ui/shared/extension"
import { sendExtensionMessage } from "../../src/communication/messages"
import { sitePattern } from "../../src/control/site-access"
import { Icon } from "../../src/ui/Icon"
import "../../src/ui/settings.css"

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
  const connectionLabel = connection === "online_paired" ? "在线 · 已配对" : connection === "offline" ? "桌面端离线" : connection === "unknown" ? "检测中" : connection === "auth_expired" ? "配对已失效" : "需要配对"
  return <main className="aui-popup">
    <header className="aui-brand"><span className="aui-brand-mark"><Icon name="spark" /></span><div><h1>AttentionUI</h1><p>让理解自然发生</p></div></header>
    <div className="aui-connection"><span className={connection === "online_paired" ? "aui-dot connected" : "aui-dot"} /><span>桌面端：{connectionLabel}</span></div>
    <label className="aui-switch-row aui-global"><span>全局启用 AttentionUI</span><input aria-label="全局启用 AttentionUI" type="checkbox" checked={access?.globalEnabled ?? true} disabled={busy || !access}
      onChange={event => { const enabled = event.target.checked; void run(async () => {
        const result = await sendExtensionMessage({ type: "UPDATE_EXTENSION_SETTINGS", settings: { enabled } })
        if (!result.ok) setMessage(result.message)
        await refresh()
      }) }} /></label>
    <section className="aui-site"><div className="aui-section-label"><Icon name="globe" /><span>当前网站</span></div>
    <h2>{access?.origin ? new URL(access.origin).hostname : "当前页面暂不支持"}</h2>
    <p className="aui-origin">{access?.origin ?? "支持中英文维基百科、百度百科及本机 Demo"}</p>
    {supported ? <>
      <button className={enabled ? "aui-button secondary aui-wide" : "aui-button aui-wide"} disabled={busy || !access} onClick={() => enabled ? void run(() => policy({ enabled: false })) : enableSite()}>{enabled ? "禁用此网站" : "启用此网站"}</button>
      <p className="aui-hint">启用后读取本站选区或关注段落。默认点击 AI 工具才发送必要片段。</p>
    </> : null}</section>
    {supported ? <>
      <section className="aui-preferences" aria-label="网站阅读偏好">
      <label className="aui-switch-row"><span className="aui-switch-copy"><strong>自动显示工具条</strong><small id="auto-toolbar-hint">鼠标停留在正文时出现</small></span><input aria-label="鼠标停留时自动显示工具条" aria-describedby="auto-toolbar-hint" type="checkbox" checked={access?.autoToolbar ?? false} disabled={busy || !enabled}
        onChange={event => { const autoToolbar = event.target.checked; void run(() => policy({ autoToolbar })) }} /></label>
      <label className="aui-switch-row"><span className="aui-switch-copy"><strong>自动 AI 工具推荐</strong><small id="auto-ai-hint">额外发送片段，可能产生费用</small></span><input aria-label="自动 AI 工具推荐" aria-describedby="auto-ai-hint" type="checkbox" checked={access?.autoAI ?? false} disabled={busy || !enabled}
        onChange={event => { const autoAI = event.target.checked; void run(() => policy({ autoAI })) }} /></label>
      </section>
      <section className="aui-tab-controls"><div className="aui-tab-status"><span>当前标签页</span><strong>{access?.paused ? "已暂停" : enabled && access?.globalEnabled ? "可使用" : "未启用"}</strong></div>
      <button className="aui-button aui-wide" disabled={busy || !access?.active} onClick={() => void run(async () => {
        if (tabId === null) return
        const result = await sendExtensionMessage({ type: "SHOW_SELECTION", tabId })
        if (!result.ok) setMessage(result.message)
        else window.close()
      })}><Icon name="spark" />对选中文字使用工具</button>
      <p className="aui-shortcut">正文选字后，也可按 <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd></p>
      <button className="aui-button aui-text-button aui-wide" disabled={busy || !enabled || !access?.globalEnabled} onClick={() => void run(async () => {
        if (tabId === null || !access) return
        const result = await sendExtensionMessage({ type: "SET_TAB_PAUSED", tabId, paused: !access.paused })
        if (result.ok && "access" in result) setAccess(result.access)
        else if (!result.ok) setMessage(result.message)
      })}>{access?.paused ? "恢复此标签页" : "暂停此标签页"}</button>
      <p className="aui-hint aui-center">暂停仅影响此标签页，关闭标签页后结束。</p></section>
    </> : null}
    {message && <p role="status" className="aui-notice error">{message}</p>}
    <footer className="aui-popup-footer"><button className="aui-button aui-text-button" onClick={() => void chrome.runtime.openOptionsPage()}><Icon name="settings" />连接与设置</button><span>片段发送 · 本机配置</span></footer>
  </main>
}
