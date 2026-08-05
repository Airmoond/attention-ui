import { BrowserWindow } from "electron"
import { join } from "node:path"

const windowOptions = {
  width: 960,
  height: 680,
  minWidth: 760,
  minHeight: 520,
  webPreferences: {
    preload: join(__dirname, "../preload/index.js"),
    contextIsolation: true,
    nodeIntegration: false
  }
} as const

export const createMainWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow(windowOptions)
  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  const loadRenderer = rendererUrl
    ? mainWindow.loadURL(rendererUrl)
    : mainWindow.loadFile(join(__dirname, "../renderer/index.html"))

  void loadRenderer.catch((error: unknown) => {
    console.error("Failed to load the FocusUI renderer.", error)
  })

  return mainWindow
}
