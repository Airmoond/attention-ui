import { app, BrowserWindow } from "electron"
import { createAiPlanner } from "./ai/ai-planner"
import { createOpenAiCompatibleProvider } from "./ai/ai-provider"
import { createToolExecutor } from "./ai/tool-executor"
import { registerIpcHandlers } from "./ipc"
import { configureLocalServer, startLocalServer, stopLocalServer } from "./server/server"
import { getFocusAuthController } from "./store/auth-store"
import { getSettings, isAiConfigured } from "./store/settings-store"
import { createMainWindow } from "./window"

const openMainWindow = (): void => {
  createMainWindow()
}

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
    executeTool: toolExecutor.execute
  })
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
