import type { AppInfo, AppSettings, ServiceStatus } from "@focus-ui/shared"

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
    }
  }
}

export {}
