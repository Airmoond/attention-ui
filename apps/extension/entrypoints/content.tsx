import visualTokens from "../../../packages/ui/tokens.css?inline"
import readingStyles from "../src/ui/reading.css?inline"
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
  style.textContent = visualTokens + readingStyles
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
