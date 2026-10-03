import { getPageAccess, getSitePolicies, getSiteOrigin, minimizePageContext, pauseKey, sitePattern, updateSitePolicy } from "../src/control/site-access"
import type { ApiError, DesktopConnectionStatus } from "@attention-ui/shared/extension"
import {
  checkDesktopAuthentication,
  checkDesktopHealth,
  executeDesktopTool,
  getDesktopPreferences,
  planDesktopTools,
  pairDesktop,
  recordDesktopToolEvent
} from "../src/communication/desktop-client"
import {
  ExtensionMessageSchema,
  type BackgroundMessageResult,
  type ConnectionStatusResult
} from "../src/communication/messages"
import {
  clearClientToken,
  getExtensionSettings,
  updateExtensionSettings
} from "../src/storage/extension-store"

const isConnectivityFailure = (code: string): boolean =>
  code === "REQUEST_TIMEOUT" || code === "DESKTOP_UNREACHABLE"

const toConnectionResult = (
  connectionStatus: DesktopConnectionStatus,
  health: ConnectionStatusResult["health"],
  message: string | null
): ConnectionStatusResult => ({ ok: true, connectionStatus, health, message })

const getConnectionStatus = async (): Promise<ConnectionStatusResult> => {
  const healthResult = await checkDesktopHealth()
  if (!healthResult.ok) {
    return toConnectionResult("offline", null, healthResult.error.message)
  }

  const settings = await getExtensionSettings()
  if (!settings.clientToken) {
    return toConnectionResult("online_unpaired", healthResult.data, null)
  }

  const authResult = await checkDesktopAuthentication()
  if (authResult.ok) {
    return toConnectionResult("online_paired", healthResult.data, null)
  }

  if (authResult.status === 401) {
    await clearClientToken()
    return toConnectionResult("auth_expired", healthResult.data, "客户端令牌已失效，请重新配对")
  }

  return toConnectionResult(
    isConnectivityFailure(authResult.error.code) ? "offline" : "online_unpaired",
    isConnectivityFailure(authResult.error.code) ? null : healthResult.data,
    authResult.error.message
  )
}

const invalidMessage = (): ApiError => ({
  ok: false,
  code: "INVALID_EXTENSION_MESSAGE",
  message: "插件请求格式无效"
})

const controlError = (message = "该网站尚未启用、已暂停或缺少访问授权"): ApiError => ({ ok: false, code: "SITE_CONTROL_BLOCKED", message })

async function synchronizeTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ATTENTIONUI_SYNC" }, { frameId: 0 })
  } catch {
    if (tab.url && (await getPageAccess(tab.url, tab.id)).active) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-scripts/content.js"] })
    }
  }
}
let synchronization: Promise<void> = Promise.resolve()
function synchronizeSites(): Promise<void> {
  const task = synchronization.catch(() => undefined).then(async () => {
    const [policies, settings] = await Promise.all([getSitePolicies(), getExtensionSettings()])
    const matches: string[] = []
    for (const [origin, policy] of Object.entries(policies.sites)) {
      if (!settings.enabled || !policy.enabled) continue
      const pattern = sitePattern(origin as NonNullable<ReturnType<typeof getSiteOrigin>>)
      if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern)
    }
    const id = "attentionui-opt-in"
    const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [id] })).length > 0
    if (!matches.length && registered) await chrome.scripting.unregisterContentScripts({ ids: [id] })
    else if (matches.length) {
      const script = { id, matches, js: ["content-scripts/content.js"], persistAcrossSessions: true, runAt: "document_idle" as const }
      if (registered) await chrome.scripting.updateContentScripts([script])
      else await chrome.scripting.registerContentScripts([script])
    }
    await Promise.allSettled((await chrome.tabs.query({})).map(synchronizeTab))
  })
  synchronization = task
  return task
}
const reportControlFailure = (): void => { console.warn("AttentionUI 网站控制同步失败，请重新加载插件") }

export default defineBackground(() => {
  void synchronizeSites().catch(reportControlFailure)
  chrome.permissions.onRemoved.addListener(() => { void synchronizeSites().catch(reportControlFailure) })
  chrome.permissions.onAdded.addListener(() => { void synchronizeSites().catch(reportControlFailure) })
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.sitePoliciesV1 || changes.enabled)) void synchronizeSites().catch(reportControlFailure)
    if (area === "session") for (const key of Object.keys(changes)) {
      if (!key.startsWith("attentionuiPaused:")) continue
      const tabId = Number(key.slice("attentionuiPaused:".length))
      void chrome.tabs.get(tabId).then(synchronizeTab).catch(reportControlFailure)
    }
  })
  chrome.tabs.onRemoved.addListener(tabId => { void chrome.storage.session.remove(pauseKey(tabId)).catch(reportControlFailure) })
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse): true => {
    void (async (): Promise<void> => {
      const parsedMessage = ExtensionMessageSchema.safeParse(message)
      if (!parsedMessage.success || sender.id !== chrome.runtime.id) {
        sendResponse(invalidMessage())
        return
      }
      const data = parsedMessage.data
      const trustedPage = sender.url?.startsWith(chrome.runtime.getURL("")) === true
      const pageMessage = ["GET_PAGE_ACCESS", "PLAN_TOOLS", "EXECUTE_TOOL", "GET_PREFERENCES", "RECORD_TOOL_EVENT"].includes(data.type)
      if (!trustedPage && (!pageMessage || sender.tab?.id === undefined || sender.frameId !== 0 || !sender.url)) {
        sendResponse(controlError())
        return
      }
      if (data.type === "GET_PAGE_ACCESS") {
        if (sender.tab?.id === undefined || !sender.url || trustedPage) { sendResponse(controlError()); return }
        sendResponse({ ok: true, access: await getPageAccess(sender.url, sender.tab.id) })
        return
      }
      if (pageMessage) {
        if (trustedPage || sender.tab?.id === undefined || !sender.url) { sendResponse(controlError()); return }
        const access = await getPageAccess(sender.url, sender.tab.id)
        if (!access.active || (data.type === "PLAN_TOOLS" && !access.autoAI)) { sendResponse(controlError()); return }
      }
      if (data.type === "GET_TAB_ACCESS" || data.type === "SET_SITE_POLICY" || data.type === "SET_TAB_PAUSED" || data.type === "SHOW_SELECTION") {
        const tab = await chrome.tabs.get(data.tabId)
        const address = tab.url ?? ""
        let access = await getPageAccess(address, data.tabId)
        if (data.type === "SET_SITE_POLICY") {
          if (!access.origin || (data.policy.enabled && !access.permission)) { sendResponse(controlError("请先授予当前网站访问权限")); return }
          await updateSitePolicy(access.origin, data.policy)
          await synchronizeSites()
        }
        if (data.type === "SET_TAB_PAUSED") await chrome.storage.session.set({ [pauseKey(data.tabId)]: data.paused })
        access = await getPageAccess(address, data.tabId)
        if (data.type === "SHOW_SELECTION") {
          if (!access.active) { sendResponse(controlError()); return }
          try { sendResponse(await chrome.tabs.sendMessage(data.tabId, { type: "ATTENTIONUI_SHOW_SELECTION" }, { frameId: 0 })) }
          catch { sendResponse(controlError("请刷新网页，选中文字后重试")) }
          return
        }
        sendResponse({ ok: true, access })
        return
      }
      let result: BackgroundMessageResult
      switch (data.type) {
        case "CHECK_DESKTOP_HEALTH":
        case "GET_CONNECTION_STATUS":
          result = await getConnectionStatus()
          break
        case "PAIR_DESKTOP": {
          const pairResult = await pairDesktop(data.pairingToken)
          if (!pairResult.ok) { result = pairResult.error; break }
          await updateExtensionSettings({ clientToken: pairResult.data.clientToken })
          result = await getConnectionStatus()
          break
        }
        case "GET_EXTENSION_SETTINGS":
          result = { ok: true, settings: await getExtensionSettings() }
          break
        case "UPDATE_EXTENSION_SETTINGS":
          result = { ok: true, settings: await updateExtensionSettings(data.settings) }
          break
        case "CLEAR_LOCAL_PAIRING":
          result = { ok: true, settings: await clearClientToken() }
          break
        case "PLAN_TOOLS": {
          const response = await planDesktopTools(minimizePageContext(data.pageContext, sender.url!))
          result = response.ok ? response.data : response.error
          break
        }
        case "EXECUTE_TOOL": {
          const response = await executeDesktopTool({ ...data.request, pageContext: minimizePageContext(data.request.pageContext, sender.url!) })
          result = response.ok ? response.data : response.error
          break
        }
        case "RECORD_TOOL_EVENT": {
          const response = await recordDesktopToolEvent(data.event)
          result = response.ok ? response.data : response.error
          break
        }
        case "GET_PREFERENCES": {
          const response = await getDesktopPreferences()
          result = response.ok ? response.data : response.error
          break
        }
      }
      sendResponse(result)
    })().catch(() => { sendResponse({ ok: false, code: "BACKGROUND_REQUEST_FAILED", message: "插件请求处理失败" }) })
    return true
  })
})
