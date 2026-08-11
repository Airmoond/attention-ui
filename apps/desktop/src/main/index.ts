import { app, BrowserWindow } from "electron"
import { createAiPlanner } from "./ai/ai-planner"
import { createOpenAiCompatibleProvider } from "./ai/ai-provider"
import { createToolExecutor } from "./ai/tool-executor"
import { registerIpcHandlers } from "./ipc"
import {
  configureLocalServer,
  isLocalServerRunning,
  onLocalServiceStatusChange,
  startLocalServer,
  stopLocalServer
} from "./server/server"
import { getFocusAuthController } from "./store/auth-store"
import {
  createDefaultPreferenceState,
  getPreferenceState,
  recordToolEvent,
  resetPreferences
} from "./store/preference-store"
import { getSettings, isAiConfigured } from "./store/settings-store"
import { createFocusTray, type FocusTrayController } from "./tray"
import { getWindowCloseDecision } from "./tray-logic"
import { createMainWindow, showMainWindow } from "./window"

let isQuitting = false
let trayController: FocusTrayController | null = null
let removeServiceStatusListener: (() => void) | null = null
let shutdownPromise: Promise<void> | null = null

const openMainWindow = (): void => {
  createMainWindow({
    onClose: (event, window): void => {
      if (getWindowCloseDecision(isQuitting) === "close") {
        return
      }
      event.preventDefault()
      window.hide()
      trayController?.notifyRunningInBackground()
    }
  })
  showMainWindow()
}

const requestApplicationQuit = (): void => {
  if (shutdownPromise) {
    return
  }
  isQuitting = true
  removeServiceStatusListener?.()
  removeServiceStatusListener = null
  shutdownPromise = (async (): Promise<void> => {
    try {
      await stopLocalServer()
    } finally {
      trayController?.destroy()
      trayController = null
      BrowserWindow.getAllWindows().forEach((window) => window.destroy())
      app.exit(0)
    }
  })()
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (app.isReady()) {
      openMainWindow()
    }
  })

  app.whenReady().then(() => {
    const aiProvider = createOpenAiCompatibleProvider({ getSettings })
    const aiPlanner = createAiPlanner({
      provider: aiProvider,
      isAiEnabled: () => getSettings().enableAI
    })
    const toolExecutor = createToolExecutor(aiProvider)
    configureLocalServer({
      getAiConfigured: isAiConfigured,
      authController: getFocusAuthController(),
      planPageContext: aiPlanner.plan,
      executeTool: toolExecutor.execute,
      recordToolEvent: (event) => {
        if (getSettings().enableHabitLearning) {
          recordToolEvent(event)
        }
      },
      getPreferences: () =>
        getSettings().enableHabitLearning
          ? getPreferenceState()
          : createDefaultPreferenceState(),
      resetPreferences
    })
    registerIpcHandlers()
    openMainWindow()
    trayController = createFocusTray({
      showWindow: openMainWindow,
      startService: startLocalServer,
      stopService: stopLocalServer,
      isServiceRunning: isLocalServerRunning,
      quitApplication: requestApplicationQuit
    })
    removeServiceStatusListener = onLocalServiceStatusChange(() => {
      trayController?.refreshMenu()
    })
    void startLocalServer()

    app.on("activate", openMainWindow)
  })

  app.on("before-quit", (event) => {
    if (!isQuitting) {
      event.preventDefault()
      requestApplicationQuit()
    }
  })
}
