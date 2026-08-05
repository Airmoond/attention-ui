import type { AppInfo, AppSettings, PairingStatus, ServiceStatus } from "@focus-ui/shared"

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
    }
  }
}

export {}
