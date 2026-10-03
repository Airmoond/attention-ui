import { createRoot } from "react-dom/client"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Desktop from "../../apps/desktop/src/renderer/src/App"
import { App as Popup } from "../../apps/extension/entrypoints/popup/App"
import { App as Options } from "../../apps/extension/entrypoints/options/App"
import { AIResultCard } from "../../apps/extension/src/ui/AIResultCard"
import { AttentionToolbar } from "../../apps/extension/src/ui/AttentionToolbar"
import { AskBox } from "../../apps/extension/src/ui/AskBox"
import { FocusReader } from "../../apps/extension/src/ui/FocusReader"
import { LoadingCard } from "../../apps/extension/src/ui/LoadingCard"
import { ErrorCard } from "../../apps/extension/src/ui/ErrorCard"
import { getLocalTools } from "../../apps/extension/src/policy/local-policy"
import type { AppSettings, ServiceStatus, PairingStatus, ToolId } from "../../packages/shared/src/types"
import type { ExtensionMessage } from "../../apps/extension/src/communication/messages"
import "../../apps/desktop/src/renderer/src/styles.css"
import "./preview.css"
import visualTokens from "../../packages/ui/tokens.css?inline"
import readingStyles from "../../apps/extension/src/ui/reading.css?inline"

// Development-only fixtures. Nothing in this entry point ships with either app.
let settings: AppSettings = { apiBaseUrl: "https://api.example.com/v1", apiKey: "preview-key", modelName: "your-model", attentionDelayMs: 900, enableAI: true, enableLocalTools: true, enableFocusMode: true, enableHabitLearning: true }
let service: ServiceStatus = { state: "running", running: true, address: "http://127.0.0.1:17321", error: null }
let pairing: PairingStatus = { pairingToken: "AUI-DEMO-2026", paired: true, lastConnectedAt: new Date().toISOString() }
const action = async () => ({ ok: true, message: "预览操作已完成，不会打开文件或发送请求。" })
Object.assign(window, { attentionUI: {
  getAppInfo: async () => ({ version: "0.1.1", platform: "win32", serviceRunning: service.running }),
  getServiceStatus: async () => service,
  startService: async () => (service = { ...service, state: "running", running: true }),
  stopService: async () => (service = { ...service, state: "stopped", running: false }),
  getSettings: async () => settings,
  updateSettings: async (next: AppSettings) => (settings = next),
  getPairingStatus: async () => pairing,
  regeneratePairingToken: async () => (pairing = { ...pairing, pairingToken: "AUI-NEW-DEMO", paired: false }),
  disconnectPlugin: async () => (pairing = { ...pairing, paired: false }),
  resetPreferences: async () => ({ globalToolCount: {}, contextToolCount: {}, lastUsedAt: {}, pinnedTools: [] }),
  getLogs: async () => [{ id: "preview", level: "info", event: "SERVICE_STARTED", message: "本地服务已启动", timestamp: Date.now() }],
  clearLogs: async () => undefined,
  testAiConnection: async () => ({ ok: true, message: "连接测试成功（模拟预览）。" }),
  openQuickStart: action, prepareExtensionInstall: action, openArticleDemo: action, openFinanceDemo: action
} })
let access = { origin: "https://zh.wikipedia.org", globalEnabled: true, enabled: true, autoToolbar: false, autoAI: false, paused: false, permission: true, active: true }
let extensionSettings = { desktopBaseUrl: "http://127.0.0.1:17321", enabled: true, clientToken: "preview-token-not-a-credential" }
const updateAccess = () => { access.active = access.globalEnabled && access.enabled && access.permission && !access.paused }
Object.assign(window, { chrome: {
  tabs: { query: async () => [{ id: 1 }] }, permissions: { request: async () => true },
  runtime: {
    openOptionsPage: async () => { window.location.hash = "options" },
    sendMessage: async (message: ExtensionMessage) => {
      if (message.type === "SET_SITE_POLICY") { access = { ...access, ...message.policy }; updateAccess() }
      if (message.type === "SET_TAB_PAUSED") { access.paused = message.paused; updateAccess() }
      if (message.type === "UPDATE_EXTENSION_SETTINGS") { extensionSettings = { ...extensionSettings, ...message.settings }; access.globalEnabled = extensionSettings.enabled; updateAccess() }
      if (["GET_TAB_ACCESS", "SET_SITE_POLICY", "SET_TAB_PAUSED"].includes(message.type)) return { ok: true, access }
      if (["GET_EXTENSION_SETTINGS", "UPDATE_EXTENSION_SETTINGS", "CLEAR_LOCAL_PAIRING"].includes(message.type)) return { ok: true, settings: extensionSettings }
      if (message.type === "SHOW_SELECTION") return { ok: false, code: "PREVIEW_ONLY", message: "此处为界面预览。请在已启用的真实网页中选文。" }
      return { ok: true, connectionStatus: "online_paired", health: null, message: "桌面端已连接（模拟预览）" }
    }
  }
} })

const context = { url: "https://example.com", pageTitle: "学习的力量", text: "学习帮助我们理解世界。", selectedText: null, nearbyHeading: null, contextKind: "text" as const, numericCandidates: [] }
const answer = "## 理解知识，从建立联系开始\n学习的关键是将新知识与已有经验连接，形成能够迁移的理解。\n- **抓住核心概念**，用自己的语言解释。\n- **主动提出问题**，检验理解中的空白。\n- **回到具体例子**，让抽象知识变得清晰。"
type Surface = "desktop" | "popup" | "options" | "reader"
type PreviewTool = ToolId | "toolbar" | "loading" | "error" | "closed"
function ReadingPreview({ tool, onTool }: { tool: PreviewTool; onTool: (tool: PreviewTool) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [mount, setMount] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const host = hostRef.current!
    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    // Leave room for the preview navigation; production placement is unchanged.
    style.textContent = visualTokens + readingStyles + ".attention-ui-message-card{top:80px;max-height:calc(100vh - 96px)}.attention-ui-reader-overlay{top:56px}.attention-ui-reader-panel{max-height:calc(100vh - 112px)}@media(max-width:800px){.attention-ui-message-card{top:106px;max-height:calc(100vh - 122px)}.attention-ui-reader-overlay{top:90px}.attention-ui-reader-panel{max-height:calc(100vh - 114px)}}"
    const container = document.createElement("div"); shadow.append(style, container); setMount(container)
  }, [])
  const passage = document.getElementById("preview-passage")
  const candidate = passage ? { element: passage, text: passage.textContent ?? "", rect: passage.getBoundingClientRect(), pointerX: 0, pointerY: 0, kind: "paragraph" as const, triggeredAt: 0 } : null
  return <div ref={hostRef} className="preview-shadow" onKeyDown={event => { if (event.key === "Escape") onTool("closed") }}>
    {mount && candidate ? createPortal(tool === "closed" ? null : tool === "toolbar" ? <AttentionToolbar candidate={candidate} tools={getLocalTools(context)} onClose={() => onTool("closed")} onToolSelect={item => onTool(item.id)} /> : tool === "focus" ? <FocusReader content={{ title: "让理解自然发生。", blocks: [{ type: "paragraph", text: context.text }, { type: "paragraph", text: "让注意力回到内容，用自己的语言理解知识。" }] }} onClose={() => onTool("closed")} /> : tool === "ask" ? <AskBox onBack={() => onTool("toolbar")} onClose={() => onTool("closed")} onSubmit={() => onTool("summarize")} /> : tool === "loading" ? <LoadingCard toolId="explain" onClose={() => onTool("closed")} /> : tool === "error" ? <ErrorCard message="桌面端暂时离线，请启动 AttentionUI 后重试。" onBack={() => onTool("toolbar")} onRetry={() => onTool("loading")} onClose={() => onTool("closed")} /> : <AIResultCard result={{ toolId: tool, success: true, content: answer, ...(tool === "chart" ? { data: { title: "每周学习时长", chartType: "bar", labels: ["周一", "周二", "周三", "周四"], values: [45, 60, 50, 80], unit: "分钟" } } : {}) }} onBack={() => onTool("toolbar")} onClose={() => onTool("closed")} />, mount) : null}
  </div>
}
function Preview() {
  const [surface, setSurface] = useState<Surface>((location.hash.slice(1) || "desktop") as Surface)
  const [tool, setTool] = useState<PreviewTool>("summarize")
  useEffect(() => {
    const sync = () => setSurface((location.hash.slice(1) || "desktop") as Surface)
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])
  const show = (next: Surface) => { location.hash = next; setSurface(next) }
  return <><div className="preview-bar"><strong>AttentionUI <span>界面预览 · 模拟数据</span></strong><nav aria-label="预览界面">{(["desktop", "popup", "options", "reader"] as const).map((id, index) => <button key={id} aria-pressed={surface === id} onClick={() => show(id)}>{["桌面端", "插件弹窗", "连接设置", "阅读工具"][index]}</button>)}</nav></div>
    {surface === "desktop" ? <Desktop /> : surface === "popup" ? <div className="preview-popup"><Popup /></div> : surface === "options" ? <Options /> : <div className="preview-reading"><article className="preview-article"><p className="eyebrow">阅读示例</p><h1>让理解自然发生。</h1><p id="preview-passage">当我们学习新的知识时，理解并非简单地记住事实。它意味着将新的概念与已有经验建立联系，在提问与探索中逐渐形成自己的认识。</p><p>一个好的阅读工具，应该在需要时出现，让注意力始终留在内容上。通过解释、总结与提问，我们可以找到理解的下一步。</p><div className="preview-controls">{(["toolbar", "summarize", "ask", "chart", "focus", "loading", "error"] as const).map(id => <button key={id} onClick={() => setTool(id)}>{({ toolbar: "工具条", summarize: "回答卡片", ask: "提问", chart: "图表", focus: "专注阅读", loading: "加载状态", error: "失败状态" })[id]}</button>)}</div></article>
      <ReadingPreview tool={tool} onTool={setTool} /></div>}
  </>
}
createRoot(document.getElementById("root")!).render(<Preview />)
