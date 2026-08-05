import type { AppInfo } from "@focus-ui/shared"

declare global {
  interface Window {
    focusUI: {
      getAppInfo: () => Promise<AppInfo>
    }
  }
}

export {}
