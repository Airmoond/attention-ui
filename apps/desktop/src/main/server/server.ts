import { createServer, type Server } from "node:http"
import express, { type ErrorRequestHandler } from "express"
import type {
  ApiError,
  ExecuteRequest,
  PageContext,
  PlanResponse,
  PreferenceState,
  ServiceStatus,
  ToolResult
} from "@focus-ui/shared"
import { getFocusUIErrorMessage } from "@focus-ui/shared"
import { getLocalFallbackPlan } from "../ai/ai-planner"
import { appLogger } from "../logger/logger"
import type { AuthController } from "./auth"
import { createAuthMiddleware, createCorsMiddleware } from "./middleware"
import { createHealthRoute } from "./routes/health"
import { createExecuteRoute, type ExecuteTool } from "./routes/execute"
import { createEventsRoute, type RecordToolEvent } from "./routes/events"
import { createPairRoute } from "./routes/pair"
import { createPlanRoute, type PlanPageContext } from "./routes/plan"
import {
  createGetPreferencesRoute,
  createResetPreferencesRoute,
  type GetPreferences,
  type ResetPreferences
} from "./routes/preferences"

const LOCAL_SERVICE_HOST = "127.0.0.1"
const LOCAL_SERVICE_PORT = 17321
const LOCAL_SERVICE_ADDRESS = `http://${LOCAL_SERVICE_HOST}:${LOCAL_SERVICE_PORT}`

type StatusListener = (status: ServiceStatus) => void

type LocalServerOptions = {
  getAiConfigured: () => boolean
  authController: AuthController
  planPageContext?: PlanPageContext
  executeTool?: ExecuteTool
  recordToolEvent?: RecordToolEvent
  getPreferences?: GetPreferences
  resetPreferences?: ResetPreferences
}

let localServer: Server | null = null
let serviceStatus: ServiceStatus = {
  state: "stopped",
  running: false,
  address: LOCAL_SERVICE_ADDRESS,
  error: null
}

const statusListeners = new Set<StatusListener>()
let getAiConfigured = (): boolean => false
const defaultPlanPageContext = async (pageContext: PageContext): Promise<PlanResponse> => ({
  source: "local",
  plan: getLocalFallbackPlan(pageContext)
})
const defaultExecuteTool = async (request: ExecuteRequest): Promise<ToolResult> => ({
  toolId: request.toolId,
  success: false,
  content: getFocusUIErrorMessage("AI_PROVIDER_ERROR"),
  errorCode: "AI_PROVIDER_ERROR"
})
let planPageContext = defaultPlanPageContext
let executeTool = defaultExecuteTool
let recordToolEvent: RecordToolEvent = () => undefined
const emptyPreferences = (): PreferenceState => ({
  globalToolCount: {},
  contextToolCount: {},
  lastUsedAt: {},
  pinnedTools: []
})
let getPreferences: GetPreferences = emptyPreferences
let resetPreferences: ResetPreferences = emptyPreferences
let authController: AuthController = {
  pair: () => ({ ok: false, code: "AUTH_NOT_READY", message: "鉴权服务尚未就绪" }),
  authorize: () => false,
  getPairingStatus: () => ({ pairingToken: "", paired: false, lastConnectedAt: null }),
  regeneratePairingToken: () => ({ pairingToken: "", paired: false, lastConnectedAt: null }),
  disconnectPlugin: () => ({ pairingToken: "", paired: false, lastConnectedAt: null })
}

const updateServiceStatus = (nextStatus: ServiceStatus): void => {
  serviceStatus = nextStatus
  statusListeners.forEach((listener) => listener(serviceStatus))
}

const describeServerError = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EADDRINUSE"
  ) {
    return `端口 ${LOCAL_SERVICE_PORT} 已被占用。`
  }

  return "本地服务启动失败。"
}

export const getLocalServiceStatus = (): ServiceStatus => serviceStatus

export const isLocalServerRunning = (): boolean => serviceStatus.running

export const configureLocalServer = ({
  getAiConfigured: nextProvider,
  authController: nextAuthController,
  planPageContext: nextPlanPageContext,
  executeTool: nextExecuteTool,
  recordToolEvent: nextRecordToolEvent,
  getPreferences: nextGetPreferences,
  resetPreferences: nextResetPreferences
}: LocalServerOptions): void => {
  getAiConfigured = nextProvider
  authController = nextAuthController
  planPageContext = nextPlanPageContext ?? defaultPlanPageContext
  executeTool = nextExecuteTool ?? defaultExecuteTool
  recordToolEvent = nextRecordToolEvent ?? (() => undefined)
  getPreferences = nextGetPreferences ?? emptyPreferences
  resetPreferences = nextResetPreferences ?? emptyPreferences
}

export const onLocalServiceStatusChange = (listener: StatusListener): (() => void) => {
  statusListeners.add(listener)
  return (): void => {
    statusListeners.delete(listener)
  }
}

export const startLocalServer = async (): Promise<ServiceStatus> => {
  if (localServer || serviceStatus.state === "starting") {
    return serviceStatus
  }

  updateServiceStatus({
    state: "starting",
    running: false,
    address: LOCAL_SERVICE_ADDRESS,
    error: null
  })

  const application = express()
  application.use(createCorsMiddleware())
  application.use(express.json({ limit: "16kb" }))
  application.get(
    "/health",
    createHealthRoute({
      getVersion: () => "0.1.0",
      getAiConfigured
    })
  )
  application.post("/v1/pair", createPairRoute(authController))
  application.use("/v1", createAuthMiddleware(authController))
  application.get("/v1/auth-check", (_request, response): void => {
    response.status(200).json({ ok: true, authenticated: true })
  })
  application.post("/v1/plan", createPlanRoute(planPageContext))
  application.post("/v1/execute", createExecuteRoute(executeTool))
  application.post("/v1/events", createEventsRoute(recordToolEvent))
  application.get("/v1/preferences", createGetPreferencesRoute(getPreferences))
  application.post(
    "/v1/preferences/reset",
    createResetPreferencesRoute(resetPreferences)
  )
  const handleRequestError: ErrorRequestHandler = (error, _request, response, _next): void => {
    const invalidJson = error instanceof SyntaxError
    const apiError: ApiError = invalidJson
      ? { ok: false, code: "INVALID_JSON", message: "请求 JSON 格式无效" }
      : { ok: false, code: "REQUEST_FAILED", message: "请求处理失败" }
    response.status(invalidJson ? 400 : 500).json(apiError)
  }
  application.use(handleRequestError)

  const nextServer = createServer(application)

  try {
    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error): void => {
        nextServer.off("listening", handleListening)
        reject(error)
      }
      const handleListening = (): void => {
        nextServer.off("error", handleError)
        resolve()
      }

      nextServer.once("error", handleError)
      nextServer.once("listening", handleListening)
      nextServer.listen(LOCAL_SERVICE_PORT, LOCAL_SERVICE_HOST)
    })

    localServer = nextServer
    updateServiceStatus({
      state: "running",
      running: true,
      address: LOCAL_SERVICE_ADDRESS,
      error: null
    })
    appLogger.info("SERVICE_STARTED", "本地服务已启动")
  } catch (error: unknown) {
    localServer = null
    updateServiceStatus({
      state: "error",
      running: false,
      address: LOCAL_SERVICE_ADDRESS,
      error: describeServerError(error)
    })
    appLogger.error("SERVICE_START_FAILED", "本地服务启动失败", {
      errorCode:
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "UNKNOWN"
    })
  }

  return serviceStatus
}

export const stopLocalServer = async (): Promise<ServiceStatus> => {
  if (!localServer) {
    if (serviceStatus.state !== "error") {
      updateServiceStatus({
        state: "stopped",
        running: false,
        address: LOCAL_SERVICE_ADDRESS,
        error: null
      })
    }
    return serviceStatus
  }

  const serverToStop = localServer
  updateServiceStatus({
    state: "stopping",
    running: false,
    address: LOCAL_SERVICE_ADDRESS,
    error: null
  })

  try {
    await new Promise<void>((resolve, reject) => {
      serverToStop.close((error?: Error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    localServer = null
    updateServiceStatus({
      state: "stopped",
      running: false,
      address: LOCAL_SERVICE_ADDRESS,
      error: null
    })
    appLogger.info("SERVICE_STOPPED", "本地服务已停止")
  } catch (_error: unknown) {
    updateServiceStatus({
      state: "error",
      running: false,
      address: LOCAL_SERVICE_ADDRESS,
      error: "本地服务停止失败。"
    })
    appLogger.error("SERVICE_STOP_FAILED", "本地服务停止失败", {
      errorCode: "SERVER_CLOSE_FAILED"
    })
  }

  return serviceStatus
}
