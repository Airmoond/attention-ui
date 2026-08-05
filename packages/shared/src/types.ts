export type AppInfo = {
  version: string
  platform: string
  serviceRunning: boolean
}

export type HealthResponse = {
  ok: true
  service: "focusui-desktop"
  version: string
  aiConfigured: boolean
}

export type ServiceStatus = {
  state: "stopped" | "starting" | "running" | "stopping" | "error"
  running: boolean
  address: string
  error: string | null
}

export type AppSettings = {
  apiBaseUrl: string
  apiKey: string
  modelName: string
  attentionDelayMs: number
  enableAI: boolean
  enableLocalTools: boolean
  enableFocusMode: boolean
  enableHabitLearning: boolean
}
