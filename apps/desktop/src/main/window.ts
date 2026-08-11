import { BrowserWindow, type Event } from "electron"
import { join } from "node:path"
import { appLogger } from "./logger/logger"

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

let mainWindow: BrowserWindow | null = null

export type MainWindowOptions = {
  onClose: (event: Event, window: BrowserWindow) => void
}

export const createMainWindow = ({ onClose }: MainWindowOptions): BrowserWindow => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  const window = new BrowserWindow(windowOptions)
  mainWindow = window
  window.on("close", (event) => onClose(event, window))
  window.on("closed", () => {
    mainWindow = null
  })
  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  const loadRenderer = rendererUrl
    ? window.loadURL(rendererUrl)
    : window.loadFile(join(__dirname, "../renderer/index.html"))

  void loadRenderer.catch((error: unknown) => {
    appLogger.error("RENDERER_LOAD_FAILED", "桌面界面加载失败", {
      errorCode: error instanceof Error ? error.name : "UNKNOWN"
    })
  })

  return window
}

export const showMainWindow = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}
