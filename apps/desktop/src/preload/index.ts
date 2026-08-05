import { contextBridge, ipcRenderer } from "electron"
import type { AppInfo, ServiceStatus } from "@focus-ui/shared"

const GET_APP_INFO_CHANNEL = "focus-ui:get-app-info"
const GET_SERVICE_STATUS_CHANNEL = "focus-ui:get-service-status"
const START_SERVICE_CHANNEL = "focus-ui:start-service"
const STOP_SERVICE_CHANNEL = "focus-ui:stop-service"

const focusUI = {
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(GET_APP_INFO_CHANNEL) as Promise<AppInfo>,
  getServiceStatus: (): Promise<ServiceStatus> =>
    ipcRenderer.invoke(GET_SERVICE_STATUS_CHANNEL) as Promise<ServiceStatus>,
  startService: (): Promise<ServiceStatus> =>
    ipcRenderer.invoke(START_SERVICE_CHANNEL) as Promise<ServiceStatus>,
  stopService: (): Promise<ServiceStatus> =>
    ipcRenderer.invoke(STOP_SERVICE_CHANNEL) as Promise<ServiceStatus>
}

contextBridge.exposeInMainWorld("focusUI", focusUI)
