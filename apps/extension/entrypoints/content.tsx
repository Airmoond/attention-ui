import { createRoot, type Root } from "react-dom/client"
import { AttentionEngine, type AttentionCandidate } from "../src/attention/attention-engine"
import { extractPageContext } from "../src/context/context-extractor"
import { SemanticBlockDebugOutline } from "../src/context/semantic-block"
import { getLocalTools } from "../src/policy/local-policy"
import type { PageAccess } from "@attention-ui/shared/extension"
import { sendExtensionMessage } from "../src/communication/messages"
import { getManualCandidate } from "../src/control/manual-selection"
import { AttentionUIRoot, type ToolbarSession } from "../src/ui/AttentionUIRoot"

const HOST_ID = "attention-ui-host"
const HOST_ATTRIBUTE = "data-attention-ui-root"

type AttentionUiHost = HTMLElement & {
  attentionUiReactRoot?: Root
}

let attentionEngine: AttentionEngine | null = null
let synchronizeVersion = 0
let access: PageAccess | null = null

const getHost = (): AttentionUiHost | null => {
  const host = document.getElementById(HOST_ID)
  return host?.getAttribute(HOST_ATTRIBUTE) === "true" ? (host as AttentionUiHost) : null
}

const removeAttentionUiRoot = (): void => {
  attentionEngine?.stop()
  attentionEngine = null
  const host = getHost()
  if (!host) {
    return
  }

  host.attentionUiReactRoot?.unmount()
  host.remove()
}

const reportAttentionCandidate = (candidate: AttentionCandidate, trigger: "hover" | "manual" = "hover"): void => {
  if (!access?.active) return
  try {
    const context = extractPageContext(candidate)
    const session: ToolbarSession = {
      trigger,
      candidate,
      context,
      tools: getLocalTools(context, {
        isLongFormEnvironment: candidate.element.closest("article, main") !== null
      })
    }
    const host = getHost()
    host?.attentionUiReactRoot?.render(<AttentionUIRoot session={session} autoAI={access.autoAI} />)

    if (import.meta.env.DEV) {
      console.debug("AttentionUI Attention Candidate", {
        kind: candidate.kind,
        rect: {
          x: Math.round(candidate.rect.x),
          y: Math.round(candidate.rect.y),
          width: Math.round(candidate.rect.width),
          height: Math.round(candidate.rect.height)
        },
        triggeredAt: Math.round(candidate.triggeredAt),
        context: {
          contextKind: context.contextKind,
          textLength: context.text.length,
          numericCandidateCount: context.numericCandidates.length
        }
      })
    }
  } catch (_error: unknown) {
    console.warn("AttentionUI 上下文提取失败")
  }
}

const startAttentionInference = (): void => {
  if (attentionEngine || !access?.active || !access.autoToolbar) {
    return
  }

  attentionEngine = new AttentionEngine({
    onAttentionCandidate: reportAttentionCandidate,
    debugOutline: import.meta.env.DEV ? new SemanticBlockDebugOutline() : undefined
  })
  attentionEngine.start()
}

const mountAttentionUiRoot = (): void => {
  const existingHost = getHost()
  if (existingHost) {
    startAttentionInference()
    return
  }

  // Avoid taking over an unrelated page element that happens to use this ID.
  if (document.getElementById(HOST_ID)) {
    return
  }

  const host = document.createElement("div") as AttentionUiHost
  host.id = HOST_ID
  host.setAttribute(HOST_ATTRIBUTE, "true")

  const shadowRoot = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = `
    :host {
      all: initial;
      color-scheme: light;
    }
    .attention-ui-toolbar {
      position: fixed;
      z-index: 2147483000;
      display: flex;
      align-items: center;
      gap: 4px;
      box-sizing: border-box;
      margin: 0;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 9px;
      padding: 6px;
      color: #ffffff;
      background: #172033;
      box-shadow: 0 10px 28px rgba(20, 33, 61, 0.28);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
      animation: attention-ui-fade-in 150ms ease-out both;
    }
    .attention-ui-tool-button,
    .attention-ui-close-button {
      box-sizing: border-box;
      margin: 0;
      border: 0;
      border-radius: 6px;
      padding: 7px 9px;
      color: #ffffff;
      background: transparent;
      font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      white-space: nowrap;
      cursor: pointer;
    }
    .attention-ui-tool-button:hover,
    .attention-ui-tool-button:focus-visible,
    .attention-ui-close-button:hover,
    .attention-ui-close-button:focus-visible {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      outline: none;
    }
    .attention-ui-tool-button:focus-visible,
    .attention-ui-close-button:focus-visible {
      box-shadow: 0 0 0 2px #8bb5ff;
    }
    .attention-ui-close-button {
      min-width: 30px;
      color: #cbd5e1;
      font-size: 16px;
      font-weight: 500;
    }
    .attention-ui-separator {
      width: 1px;
      height: 20px;
      margin: 0 2px;
      background: rgba(255, 255, 255, 0.18);
    }
    .attention-ui-message-card {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483000;
      display: grid;
      gap: 10px;
      box-sizing: border-box;
      width: min(320px, calc(100vw - 32px));
      margin: 0;
      border: 1px solid #d8e1ef;
      border-radius: 10px;
      padding: 14px;
      color: #172033;
      background: #ffffff;
      box-shadow: 0 12px 32px rgba(20, 33, 61, 0.2);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      animation: attention-ui-fade-in 150ms ease-out both;
    }
    .attention-ui-result-card {
      width: min(460px, calc(100vw - 32px));
      max-height: min(72vh, 680px);
      overflow: hidden auto;
      overscroll-behavior: contain;
    }
    .attention-ui-result-title {
      margin: 0;
      color: #172033;
      font: 700 17px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .attention-ui-result-text {
      display: grid;
      gap: 8px;
      color: #263957;
      overflow-wrap: anywhere;
    }
    .attention-ui-result-text p,
    .attention-ui-result-text h3 {
      margin: 0;
      font: 400 14px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      white-space: pre-wrap;
    }
    .attention-ui-result-text h3 {
      color: #172033;
      font-size: 15px;
      font-weight: 700;
    }
    .attention-ui-result-text strong {
      color: #172033;
      font-weight: 700;
    }
    .attention-ui-result-text code {
      border-radius: 4px;
      padding: 1px 4px;
      color: #1749c7;
      background: #eef3fb;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .attention-ui-result-list-item {
      position: relative;
      padding-left: 15px;
    }
    .attention-ui-result-list-item::before {
      position: absolute;
      left: 2px;
      content: "•";
      color: #275efe;
    }
    .attention-ui-structured-result {
      display: grid;
      gap: 9px;
    }
    .attention-ui-structured-result h3 {
      margin: 0;
      color: #263957;
      font: 700 14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .attention-ui-chart-list {
      display: grid;
      gap: 6px;
      margin: 0;
    }
    .attention-ui-chart-canvas {
      width: 100%;
      height: 300px;
      min-height: 260px;
      border: 1px solid #e1e7f0;
      border-radius: 8px;
      background: #ffffff;
    }
    .attention-ui-chart-list > div {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f1f5fb;
    }
    .attention-ui-chart-list dt,
    .attention-ui-chart-list dd {
      margin: 0;
      color: #263957;
      font: 500 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .attention-ui-chart-list dd {
      color: #1749c7;
      font-weight: 700;
    }
    .attention-ui-table-scroll {
      max-width: 100%;
      overflow-x: auto;
    }
    .attention-ui-data-table {
      width: 100%;
      border-collapse: collapse;
      color: #263957;
      background: #ffffff;
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .attention-ui-data-table th,
    .attention-ui-data-table td {
      border: 1px solid #d8e1ef;
      padding: 8px 10px;
      text-align: left;
      overflow-wrap: anywhere;
    }
    .attention-ui-data-table th {
      background: #f1f5fb;
      font-weight: 700;
    }
    .attention-ui-ask-input {
      box-sizing: border-box;
      width: 100%;
      min-height: 88px;
      resize: vertical;
      border: 1px solid #c9d5e6;
      border-radius: 7px;
      padding: 9px 10px;
      color: #172033;
      background: #ffffff;
      font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .attention-ui-ask-input:focus {
      border-color: #275efe;
      outline: none;
      box-shadow: 0 0 0 2px rgba(39, 94, 254, 0.18);
    }
    .attention-ui-input-hint {
      margin: -4px 0 0;
      color: #64748b;
      font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .attention-ui-loading-row {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .attention-ui-loading-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #275efe;
      animation: attention-ui-pulse 900ms ease-in-out infinite alternate;
    }
    .attention-ui-message-text {
      margin: 0;
      color: #263957;
      font-size: 14px;
      line-height: 1.5;
    }
    .attention-ui-message-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .attention-ui-message-button {
      box-sizing: border-box;
      margin: 0;
      border: 1px solid #c9d5e6;
      border-radius: 6px;
      padding: 6px 10px;
      color: #263957;
      background: #ffffff;
      font: 600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
    }
    .attention-ui-message-button:hover,
    .attention-ui-message-button:focus-visible {
      border-color: #275efe;
      color: #1749c7;
      outline: none;
      box-shadow: 0 0 0 2px rgba(39, 94, 254, 0.2);
    }
    .attention-ui-message-button:disabled {
      border-color: #d8e1ef;
      color: #94a3b8;
      background: #f8fafc;
      cursor: not-allowed;
      box-shadow: none;
    }
    .attention-ui-reader-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      display: grid;
      place-items: center;
      box-sizing: border-box;
      width: 100vw;
      height: 100vh;
      margin: 0;
      padding: 24px;
      background: rgba(10, 17, 30, 0.76);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      animation: attention-ui-fade-in 150ms ease-out both;
    }
    .attention-ui-reader-panel {
      box-sizing: border-box;
      width: min(820px, 100%);
      max-height: calc(100vh - 48px);
      margin: 0;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 14px;
      padding: 0;
      overflow: hidden auto;
      color: #172033;
      background: #fbfcfe;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.38);
      overscroll-behavior: contain;
    }
    .attention-ui-reader-header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 20px;
      box-sizing: border-box;
      padding: 24px 28px 18px;
      border-bottom: 1px solid #e3e9f2;
      background: rgba(251, 252, 254, 0.97);
      backdrop-filter: blur(8px);
    }
    .attention-ui-reader-title {
      margin: 0;
      color: #172033;
      font: 700 clamp(24px, 3vw, 34px)/1.25 Georgia, "Times New Roman", serif;
      letter-spacing: -0.015em;
    }
    .attention-ui-reader-close {
      flex: 0 0 auto;
      box-sizing: border-box;
      width: 36px;
      height: 36px;
      margin: 0;
      border: 1px solid #c9d5e6;
      border-radius: 8px;
      padding: 0;
      color: #334155;
      background: #ffffff;
      font: 500 22px/1 system-ui, sans-serif;
      cursor: pointer;
    }
    .attention-ui-reader-close:hover,
    .attention-ui-reader-close:focus-visible {
      border-color: #275efe;
      color: #1749c7;
      outline: none;
      box-shadow: 0 0 0 3px rgba(39, 94, 254, 0.18);
    }
    .attention-ui-reader-content {
      box-sizing: border-box;
      padding: 24px 28px 42px;
    }
    .attention-ui-reader-heading {
      margin: 30px 0 12px;
      color: #172033;
      font: 700 23px/1.35 Georgia, "Times New Roman", serif;
    }
    .attention-ui-reader-heading:first-child {
      margin-top: 0;
    }
    .attention-ui-reader-heading-3 {
      font-size: 19px;
    }
    .attention-ui-reader-paragraph,
    .attention-ui-reader-list-item,
    .attention-ui-reader-quote {
      margin: 0 0 17px;
      color: #263957;
      font: 400 17px/1.8 Georgia, "Times New Roman", serif;
      overflow-wrap: anywhere;
    }
    .attention-ui-reader-list-item {
      position: relative;
      padding-left: 20px;
    }
    .attention-ui-reader-list-item::before {
      position: absolute;
      left: 2px;
      content: "•";
      color: #275efe;
    }
    .attention-ui-reader-quote {
      border-left: 3px solid #7aa2ff;
      padding: 4px 0 4px 18px;
      color: #40516d;
    }
    .attention-ui-reader-code {
      box-sizing: border-box;
      margin: 0 0 18px;
      border-radius: 9px;
      padding: 16px;
      overflow: auto;
      color: #dce7ff;
      background: #172033;
      font: 13px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    @media (max-width: 600px) {
      .attention-ui-reader-overlay { padding: 10px; }
      .attention-ui-reader-panel { max-height: calc(100vh - 20px); }
      .attention-ui-reader-header { padding: 20px 18px 16px; }
      .attention-ui-reader-content { padding: 20px 18px 34px; }
    }
    @keyframes attention-ui-fade-in {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes attention-ui-pulse {
      from { opacity: 0.35; transform: scale(0.82); }
      to { opacity: 1; transform: scale(1); }
    }
  `
  const mountElement = document.createElement("div")
  shadowRoot.append(style, mountElement)
  document.documentElement.append(host)
  host.attentionUiReactRoot = createRoot(mountElement)
  host.attentionUiReactRoot.render(<AttentionUIRoot session={null} />)
  startAttentionInference()
}

const synchronizeAttentionUiRoot = async (): Promise<void> => {
  const version = ++synchronizeVersion
  access = null
  removeAttentionUiRoot()
  const result = await sendExtensionMessage({ type: "GET_PAGE_ACCESS" })
  if (version !== synchronizeVersion || !result.ok || !("access" in result)) return
  access = result.access
  if (access.active) mountAttentionUiRoot()
}
const reportSynchronizationFailure = (): void => {
  access = null
  removeAttentionUiRoot()
  console.warn("AttentionUI 网站状态同步失败")
}
const showSelection = (): boolean => {
  if (!access?.active) return false
  const candidate = getManualCandidate()
  if (!candidate) return false
  reportAttentionCandidate(candidate, "manual")
  return true
}
export default defineContentScript({
  registration: "runtime",
  matches: [],
  main(ctx) {
    const synchronize = (): void => { void synchronizeAttentionUiRoot().catch(reportSynchronizationFailure) }
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
      if (area === "local" && (changes.enabled || changes.sitePoliciesV1)) synchronize()
    }
    const message = (value: unknown, sender: chrome.runtime.MessageSender, respond: (result: unknown) => void): boolean => {
      if (sender.id !== chrome.runtime.id || !value || typeof value !== "object" || !("type" in value)) return false
      if (value.type === "ATTENTIONUI_SYNC") { synchronize(); respond({ ok: true }); return false }
      if (value.type === "ATTENTIONUI_SHOW_SELECTION") {
        void synchronizeAttentionUiRoot().then(() => {
          respond(showSelection() ? { ok: true } : { ok: false, code: "NO_SAFE_SELECTION", message: "请先在正文中选中文字，再唤起工具。" })
        }).catch(() => { reportSynchronizationFailure(); respond({ ok: false, code: "CONTROL_FAILED", message: "网站状态同步失败，请重试。" }) })
        return true
      }
      return false
    }
    const keydown = (event: KeyboardEvent): void => {
      if (access?.active && event.altKey && event.shiftKey && event.code === "KeyF" && !event.repeat) {
        if (showSelection()) event.preventDefault()
      }
    }
    const hide = (): void => { ++synchronizeVersion; access = null; removeAttentionUiRoot() }
    synchronize()
    chrome.storage.onChanged.addListener(changed)
    chrome.runtime.onMessage.addListener(message)
    window.addEventListener("keydown", keydown)
    window.addEventListener("pagehide", hide)
    window.addEventListener("pageshow", synchronize)
    window.addEventListener("popstate", synchronize)
    ctx.onInvalidated(() => {
      hide()
      chrome.storage.onChanged.removeListener(changed)
      chrome.runtime.onMessage.removeListener(message)
      window.removeEventListener("keydown", keydown)
      window.removeEventListener("pagehide", hide)
      window.removeEventListener("pageshow", synchronize)
      window.removeEventListener("popstate", synchronize)
    })
  }
})
