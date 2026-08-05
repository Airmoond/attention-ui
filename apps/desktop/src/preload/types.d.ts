import type { AppInfo, ServiceStatus } from "@focus-ui/shared"

declare global {
  interface Window {
    focusUI: {
      getAppInfo: () => Promise<AppInfo>
      getServiceStatus: () => Promise<ServiceStatus>
      startService: () => Promise<ServiceStatus>
      stopService: () => Promise<ServiceStatus>
    }
  }
}

export {}
