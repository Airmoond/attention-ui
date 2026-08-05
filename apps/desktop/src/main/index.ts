import { app, BrowserWindow } from "electron"
import { registerIpcHandlers } from "./ipc"
import { configureLocalServer, startLocalServer, stopLocalServer } from "./server/server"
import { isAiConfigured } from "./store/settings-store"
import { createMainWindow } from "./window"

const openMainWindow = (): void => {
  createMainWindow()
}

app.whenReady().then(() => {
  configureLocalServer({ getAiConfigured: isAiConfigured })
  registerIpcHandlers()
  openMainWindow()
  void startLocalServer()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow()
    }
  })
})

app.on("before-quit", (event) => {
  event.preventDefault()
  void stopLocalServer().finally(() => {
    app.exit()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
