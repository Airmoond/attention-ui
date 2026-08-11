import type { ApiError, DesktopConnectionStatus } from "@focus-ui/shared/extension"
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

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse): true => {
    void (async (): Promise<void> => {
      const parsedMessage = ExtensionMessageSchema.safeParse(message)
      if (!parsedMessage.success) {
        sendResponse(invalidMessage())
        return
      }

      let result: BackgroundMessageResult
      switch (parsedMessage.data.type) {
        case "CHECK_DESKTOP_HEALTH":
        case "GET_CONNECTION_STATUS":
          result = await getConnectionStatus()
          break
        case "PAIR_DESKTOP": {
          const pairResult = await pairDesktop(parsedMessage.data.pairingToken)
          if (!pairResult.ok) {
            result = pairResult.error
            break
          }
          await updateExtensionSettings({ clientToken: pairResult.data.clientToken })
          result = await getConnectionStatus()
          break
        }
        case "GET_EXTENSION_SETTINGS":
          result = { ok: true, settings: await getExtensionSettings() }
          break
        case "UPDATE_EXTENSION_SETTINGS":
          result = { ok: true, settings: await updateExtensionSettings(parsedMessage.data.settings) }
          break
        case "CLEAR_LOCAL_PAIRING":
          result = { ok: true, settings: await clearClientToken() }
          break
        case "PLAN_TOOLS": {
          const planResult = await planDesktopTools(parsedMessage.data.pageContext)
          result = planResult.ok ? planResult.data : planResult.error
          break
        }
        case "EXECUTE_TOOL": {
          const executeResult = await executeDesktopTool(parsedMessage.data.request)
          result = executeResult.ok ? executeResult.data : executeResult.error
          break
        }
        case "RECORD_TOOL_EVENT": {
          const eventResult = await recordDesktopToolEvent(parsedMessage.data.event)
          result = eventResult.ok ? eventResult.data : eventResult.error
          break
        }
        case "GET_PREFERENCES": {
          const preferencesResult = await getDesktopPreferences()
          result = preferencesResult.ok
            ? preferencesResult.data
            : preferencesResult.error
          break
        }
      }
      sendResponse(result)
    })().catch((_error: unknown) => {
      sendResponse({ ok: false, code: "BACKGROUND_REQUEST_FAILED", message: "插件请求处理失败" })
    })
    return true
  })
})
