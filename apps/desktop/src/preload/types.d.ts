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

declare global {
  interface Window {
    focusUI: {
      getAppInfo: () => Promise<AppInfo>
      getServiceStatus: () => Promise<ServiceStatus>
      startService: () => Promise<ServiceStatus>
      stopService: () => Promise<ServiceStatus>
      getSettings: () => Promise<AppSettings>
      updateSettings: (settings: AppSettings) => Promise<AppSettings>
      resetSettings: () => Promise<AppSettings>
      getPairingStatus: () => Promise<PairingStatus>
      regeneratePairingToken: () => Promise<PairingStatus>
      disconnectPlugin: () => Promise<PairingStatus>
      resetPreferences: () => Promise<PreferenceState>
      getLogs: () => Promise<LogEntry[]>
      clearLogs: () => Promise<void>
      openQuickStart: () => Promise<OnboardingActionResult>
      prepareExtensionInstall: () => Promise<OnboardingActionResult>
      openArticleDemo: () => Promise<OnboardingActionResult>
      openFinanceDemo: () => Promise<OnboardingActionResult>
      testAiConnection: (settings: AppSettings) => Promise<AiConnectionTestResult>
    }
  }
}

export {}
