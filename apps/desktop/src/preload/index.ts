import { contextBridge, ipcRenderer } from "electron"
import type { AppInfo, AppSettings, ServiceStatus } from "@focus-ui/shared"

const GET_APP_INFO_CHANNEL = "focus-ui:get-app-info"
const GET_SERVICE_STATUS_CHANNEL = "focus-ui:get-service-status"
const START_SERVICE_CHANNEL = "focus-ui:start-service"
const STOP_SERVICE_CHANNEL = "focus-ui:stop-service"
const GET_SETTINGS_CHANNEL = "focus-ui:get-settings"
const UPDATE_SETTINGS_CHANNEL = "focus-ui:update-settings"
const RESET_SETTINGS_CHANNEL = "focus-ui:reset-settings"

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
    ipcRenderer.invoke(RESET_SETTINGS_CHANNEL) as Promise<AppSettings>
}

contextBridge.exposeInMainWorld("focusUI", focusUI)
