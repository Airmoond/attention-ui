import { app, ipcMain } from "electron"
import type { AppInfo, AppSettings, PairingStatus, ServiceStatus } from "@focus-ui/shared"
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
}
