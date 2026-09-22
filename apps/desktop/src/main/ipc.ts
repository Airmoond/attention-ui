import { app, clipboard, ipcMain, shell } from "electron"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  AppSettingsSchema,
  getFocusUIErrorMessage,
  type AiConnectionTestResult,
  type AppInfo,
  type AppSettings,
  type LogEntry,
  type OnboardingActionResult,
  type PairingStatus,
  type PreferenceState,
  type ServiceStatus
} from "@focus-ui/shared"
import { createOpenAiCompatibleProvider, AiProviderError } from "./ai/ai-provider"
import {
  getLocalServiceStatus,
  isLocalServerRunning,
  startLocalServer,
  stopLocalServer
} from "./server/server"
import { getSettings, resetSettings, updateSettings } from "./store/settings-store"
import {
  disconnectPlugin,
  getPairingStatus,
  regeneratePairingToken
} from "./store/auth-store"
import { resetPreferences } from "./store/preference-store"
import { appLogger } from "./logger/logger"
import { getOnboardingAssets } from "./onboarding"

const GET_APP_INFO_CHANNEL = "focus-ui:get-app-info"
const GET_SERVICE_STATUS_CHANNEL = "focus-ui:get-service-status"
const START_SERVICE_CHANNEL = "focus-ui:start-service"
const STOP_SERVICE_CHANNEL = "focus-ui:stop-service"
const GET_SETTINGS_CHANNEL = "focus-ui:get-settings"
const UPDATE_SETTINGS_CHANNEL = "focus-ui:update-settings"
const RESET_SETTINGS_CHANNEL = "focus-ui:reset-settings"
const GET_PAIRING_STATUS_CHANNEL = "focus-ui:get-pairing-status"
const REGENERATE_PAIRING_TOKEN_CHANNEL = "focus-ui:regenerate-pairing-token"
const DISCONNECT_PLUGIN_CHANNEL = "focus-ui:disconnect-plugin"
const TEST_AI_CONNECTION_CHANNEL = "focus-ui:test-ai-connection"
const RESET_PREFERENCES_CHANNEL = "focus-ui:reset-preferences"
const GET_LOGS_CHANNEL = "focus-ui:get-logs"
const CLEAR_LOGS_CHANNEL = "focus-ui:clear-logs"
const OPEN_QUICK_START_CHANNEL = "focus-ui:open-quick-start"
const PREPARE_EXTENSION_INSTALL_CHANNEL = "focus-ui:prepare-extension-install"
const OPEN_ARTICLE_DEMO_CHANNEL = "focus-ui:open-article-demo"
const OPEN_FINANCE_DEMO_CHANNEL = "focus-ui:open-finance-demo"

const openLocalOnboardingPage = async (path: string): Promise<OnboardingActionResult> => {
  const serviceStatus = isLocalServerRunning()
    ? getLocalServiceStatus()
    : await startLocalServer()
  if (!serviceStatus.running) {
    return { ok: false, message: serviceStatus.error ?? "本地服务未启动" }
  }

  try {
    await shell.openExternal(`${serviceStatus.address}${path}`)
    return { ok: true, message: "已在浏览器中打开" }
  } catch (_error: unknown) {
    return { ok: false, message: "无法打开浏览器，请检查默认浏览器设置" }
  }
}

export const registerIpcHandlers = (): void => {
  ipcMain.handle(GET_APP_INFO_CHANNEL, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    serviceRunning: isLocalServerRunning()
  }))
  ipcMain.handle(GET_SERVICE_STATUS_CHANNEL, (): ServiceStatus => getLocalServiceStatus())
  ipcMain.handle(START_SERVICE_CHANNEL, (): Promise<ServiceStatus> => startLocalServer())
  ipcMain.handle(STOP_SERVICE_CHANNEL, (): Promise<ServiceStatus> => stopLocalServer())
  ipcMain.handle(GET_SETTINGS_CHANNEL, (): AppSettings => getSettings())
  ipcMain.handle(UPDATE_SETTINGS_CHANNEL, (_event, input: unknown): AppSettings =>
    updateSettings(input)
  )
  ipcMain.handle(RESET_SETTINGS_CHANNEL, (): AppSettings => resetSettings())
  ipcMain.handle(GET_PAIRING_STATUS_CHANNEL, (): PairingStatus => getPairingStatus())
  ipcMain.handle(REGENERATE_PAIRING_TOKEN_CHANNEL, (): PairingStatus =>
    regeneratePairingToken()
  )
  ipcMain.handle(DISCONNECT_PLUGIN_CHANNEL, (): PairingStatus => disconnectPlugin())
  ipcMain.handle(RESET_PREFERENCES_CHANNEL, (): PreferenceState => {
    const preferences = resetPreferences()
    appLogger.info("PREFERENCES_RESET", "习惯数据已清除")
    return preferences
  })
  ipcMain.handle(GET_LOGS_CHANNEL, (): LogEntry[] => appLogger.getLogs())
  ipcMain.handle(CLEAR_LOGS_CHANNEL, (): void => appLogger.clear())
  ipcMain.handle(OPEN_QUICK_START_CHANNEL, (): Promise<OnboardingActionResult> =>
    openLocalOnboardingPage("/guide")
  )
  ipcMain.handle(PREPARE_EXTENSION_INSTALL_CHANNEL, (): OnboardingActionResult => {
    const extensionDirectory = getOnboardingAssets().extensionDirectory
    const manifestPath = join(extensionDirectory, "manifest.json")
    if (!existsSync(manifestPath)) {
      return { ok: false, message: "未找到内置Chrome插件，请重新安装FocusUI" }
    }

    clipboard.writeText(extensionDirectory)
    shell.showItemInFolder(manifestPath)
    return { ok: true, message: "插件文件夹已打开，路径也已复制到剪贴板" }
  })
  ipcMain.handle(OPEN_ARTICLE_DEMO_CHANNEL, (): Promise<OnboardingActionResult> =>
    openLocalOnboardingPage("/demo/article.html")
  )
  ipcMain.handle(OPEN_FINANCE_DEMO_CHANNEL, (): Promise<OnboardingActionResult> =>
    openLocalOnboardingPage("/demo/finance.html")
  )
  ipcMain.handle(
    TEST_AI_CONNECTION_CHANNEL,
    async (_event, input: unknown): Promise<AiConnectionTestResult> => {
      const parsedSettings = AppSettingsSchema.safeParse(input)
      if (!parsedSettings.success) {
        return { ok: false, message: "AI配置无效" }
      }

      const provider = createOpenAiCompatibleProvider({
        getSettings: () => parsedSettings.data
      })
      try {
        await provider.complete({
          systemPrompt: "这是FocusUI Desktop连接测试。只回复OK。",
          userPrompt: "connection test"
        })
        return { ok: true, message: "AI服务连接成功" }
      } catch (error: unknown) {
        const errorCode =
          error instanceof AiProviderError
            ? error.code === "AI_RATE_LIMITED"
              ? "AI_PROVIDER_ERROR"
              : error.code
            : "UNKNOWN_ERROR"
        return {
          ok: false,
          errorCode,
          message: getFocusUIErrorMessage(errorCode)
        }
      }
    }
  )
}
