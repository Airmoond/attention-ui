import { contextBridge, ipcRenderer } from "electron"
import type { AppInfo } from "@focus-ui/shared"

const GET_APP_INFO_CHANNEL = "focus-ui:get-app-info"

const focusUI = {
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(GET_APP_INFO_CHANNEL) as Promise<AppInfo>
}

contextBridge.exposeInMainWorld("focusUI", focusUI)
