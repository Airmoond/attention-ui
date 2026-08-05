import { app, BrowserWindow } from "electron"
import { createMainWindow } from "./window"

const openMainWindow = (): void => {
  createMainWindow()
}

app.whenReady().then(() => {
  openMainWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
