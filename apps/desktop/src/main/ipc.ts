import { app, ipcMain } from "electron"
import type { AppInfo } from "@focus-ui/shared"

const GET_APP_INFO_CHANNEL = "focus-ui:get-app-info"

export const registerIpcHandlers = (): void => {
  ipcMain.handle(GET_APP_INFO_CHANNEL, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform,
    serviceRunning: false
  }))
}
