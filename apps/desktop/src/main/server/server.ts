import { createServer, type Server } from "node:http"
import express from "express"
import type { ServiceStatus } from "@focus-ui/shared"
import { createHealthRoute } from "./routes/health"

const LOCAL_SERVICE_HOST = "127.0.0.1"
const LOCAL_SERVICE_PORT = 17321
const LOCAL_SERVICE_ADDRESS = `http://${LOCAL_SERVICE_HOST}:${LOCAL_SERVICE_PORT}`

type StatusListener = (status: ServiceStatus) => void

type LocalServerOptions = {
  getAiConfigured: () => boolean
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

export const configureLocalServer = ({ getAiConfigured: nextProvider }: LocalServerOptions): void => {
  getAiConfigured = nextProvider
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
  application.get(
    "/health",
    createHealthRoute({
      getVersion: () => "0.1.0",
      getAiConfigured
    })
  )

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
  } catch (error: unknown) {
    localServer = null
    updateServiceStatus({
      state: "error",
      running: false,
      address: LOCAL_SERVICE_ADDRESS,
      error: describeServerError(error)
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
  } catch (_error: unknown) {
    updateServiceStatus({
      state: "error",
      running: false,
      address: LOCAL_SERVICE_ADDRESS,
      error: "本地服务停止失败。"
    })
  }

  return serviceStatus
}
