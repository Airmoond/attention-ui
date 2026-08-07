import { createRoot, type Root } from "react-dom/client"
import { AttentionEngine, type AttentionCandidate } from "../src/attention/attention-engine"
import { extractPageContext } from "../src/context/context-extractor"
import { SemanticBlockDebugOutline, truncateText } from "../src/context/semantic-block"
import { getExtensionSettings } from "../src/storage/extension-store"
import { FocusUIRoot } from "../src/ui/FocusUIRoot"

const HOST_ID = "focus-ui-host"
const HOST_ATTRIBUTE = "data-focus-ui-root"

type FocusUiHost = HTMLElement & {
  focusUiReactRoot?: Root
}

let attentionEngine: AttentionEngine | null = null
let synchronizeVersion = 0

const getHost = (): FocusUiHost | null => {
  const host = document.getElementById(HOST_ID)
  return host?.getAttribute(HOST_ATTRIBUTE) === "true" ? (host as FocusUiHost) : null
}

const removeFocusUiRoot = (): void => {
  attentionEngine?.stop()
  attentionEngine = null
  const host = getHost()
  if (!host) {
    return
  }

  host.focusUiReactRoot?.unmount()
  host.remove()
}

const reportAttentionCandidate = (candidate: AttentionCandidate): void => {
  if (!import.meta.env.DEV) {
    return
  }

  try {
    const context = extractPageContext(candidate)
    console.debug("FocusUI Attention Candidate", {
      kind: candidate.kind,
      textPreview: truncateText(candidate.text, 80),
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
        numericCandidateCount: context.numericCandidates.length,
        nearbyHeading: context.nearbyHeading
      }
    })
  } catch (_error: unknown) {
    console.warn("FocusUI 上下文提取失败")
  }
}

const startAttentionInference = (): void => {
  if (attentionEngine) {
    return
  }

  attentionEngine = new AttentionEngine({
    onAttentionCandidate: reportAttentionCandidate,
    debugOutline: import.meta.env.DEV ? new SemanticBlockDebugOutline() : undefined
  })
  attentionEngine.start()
}

const mountFocusUiRoot = (): void => {
  const existingHost = getHost()
  if (existingHost) {
    startAttentionInference()
    return
  }

  // Avoid taking over an unrelated page element that happens to use this ID.
  if (document.getElementById(HOST_ID)) {
    return
  }

  const host = document.createElement("div") as FocusUiHost
  host.id = HOST_ID
  host.setAttribute(HOST_ATTRIBUTE, "true")

  const shadowRoot = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = `
    :host { all: initial; }
    .focus-ui-status {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483000;
      box-sizing: border-box;
      margin: 0;
      border: 0;
      border-radius: 999px;
      padding: 9px 13px;
      color: #ffffff;
      background: #275efe;
      box-shadow: 0 8px 24px rgba(20, 33, 61, 0.24);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: 0;
      cursor: default;
    }
  `
  const mountElement = document.createElement("div")
  shadowRoot.append(style, mountElement)
  document.documentElement.append(host)
  host.focusUiReactRoot = createRoot(mountElement)
  host.focusUiReactRoot.render(<FocusUIRoot />)
  startAttentionInference()
}

const synchronizeFocusUiRoot = async (): Promise<void> => {
  const version = ++synchronizeVersion
  const settings = await getExtensionSettings()
  if (version !== synchronizeVersion) {
    return
  }
  if (settings.enabled) {
    mountFocusUiRoot()
    return
  }

  removeFocusUiRoot()
}

const reportSynchronizationFailure = (): void => {
  console.warn("FocusUI 网页测试组件状态同步失败")
}

export default defineContentScript({
  matches: ["https://en.wikipedia.org/*", "file:///*"],
  main() {
    void synchronizeFocusUiRoot().catch(reportSynchronizationFailure)

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes.enabled) {
        return
      }

      void synchronizeFocusUiRoot().catch(reportSynchronizationFailure)
    })

    window.addEventListener("pagehide", removeFocusUiRoot, { once: true })
  }
})
