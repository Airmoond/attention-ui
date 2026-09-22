import { contextBridge, ipcRenderer } from "electron"
import type {
  AiConnectionTestResult,
  AppInfo,
  AppSettings,
  LogEntry,
  OnboardingActionResult,
  PairingStatus,
  PreferenceState,
  ServiceStatus
} from "@focus-ui/shared"

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

const focusUI = {
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(GET_APP_INFO_CHANNEL) as Promise<AppInfo>,
  getServiceStatus: (): Promise<ServiceStatus> =>
    ipcRenderer.invoke(GET_SERVICE_STATUS_CHANNEL) as Promise<ServiceStatus>,
  startService: (): Promise<ServiceStatus> =>
    ipcRenderer.invoke(START_SERVICE_CHANNEL) as Promise<ServiceStatus>,
  stopService: (): Promise<ServiceStatus> =>
    ipcRenderer.invoke(STOP_SERVICE_CHANNEL) as Promise<ServiceStatus>,
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(GET_SETTINGS_CHANNEL) as Promise<AppSettings>,
  updateSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke(UPDATE_SETTINGS_CHANNEL, settings) as Promise<AppSettings>,
  resetSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(RESET_SETTINGS_CHANNEL) as Promise<AppSettings>,
  getPairingStatus: (): Promise<PairingStatus> =>
    ipcRenderer.invoke(GET_PAIRING_STATUS_CHANNEL) as Promise<PairingStatus>,
  regeneratePairingToken: (): Promise<PairingStatus> =>
    ipcRenderer.invoke(REGENERATE_PAIRING_TOKEN_CHANNEL) as Promise<PairingStatus>,
  disconnectPlugin: (): Promise<PairingStatus> =>
    ipcRenderer.invoke(DISCONNECT_PLUGIN_CHANNEL) as Promise<PairingStatus>,
  resetPreferences: (): Promise<PreferenceState> =>
    ipcRenderer.invoke(RESET_PREFERENCES_CHANNEL) as Promise<PreferenceState>,
  getLogs: (): Promise<LogEntry[]> =>
    ipcRenderer.invoke(GET_LOGS_CHANNEL) as Promise<LogEntry[]>,
  clearLogs: (): Promise<void> =>
    ipcRenderer.invoke(CLEAR_LOGS_CHANNEL) as Promise<void>,
  openQuickStart: (): Promise<OnboardingActionResult> =>
    ipcRenderer.invoke(OPEN_QUICK_START_CHANNEL) as Promise<OnboardingActionResult>,
  prepareExtensionInstall: (): Promise<OnboardingActionResult> =>
    ipcRenderer.invoke(PREPARE_EXTENSION_INSTALL_CHANNEL) as Promise<OnboardingActionResult>,
  openArticleDemo: (): Promise<OnboardingActionResult> =>
    ipcRenderer.invoke(OPEN_ARTICLE_DEMO_CHANNEL) as Promise<OnboardingActionResult>,
  openFinanceDemo: (): Promise<OnboardingActionResult> =>
    ipcRenderer.invoke(OPEN_FINANCE_DEMO_CHANNEL) as Promise<OnboardingActionResult>,
  testAiConnection: (settings: AppSettings): Promise<AiConnectionTestResult> =>
    ipcRenderer.invoke(TEST_AI_CONNECTION_CHANNEL, settings) as Promise<AiConnectionTestResult>
}

contextBridge.exposeInMainWorld("focusUI", focusUI)
