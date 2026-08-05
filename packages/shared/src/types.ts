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

export type PairRequest = {
  pairingToken: string
}

export type PairResponse = {
  ok: true
  clientToken: string
}

export type ApiError = {
  ok: false
  code: string
  message: string
}

export type ExtensionSettings = {
  desktopBaseUrl: "http://127.0.0.1:17321" | "http://localhost:17321"
  clientToken: string | null
  enabled: boolean
}

export type DesktopConnectionStatus =
  | "unknown"
  | "offline"
  | "online_unpaired"
  | "online_paired"
  | "auth_expired"

export type AuthCheckResponse = {
  ok: true
  authenticated: true
}

export type AuthState = {
  pairingToken: string
  clientToken: string | null
  tokenVersion: number
  lastConnectedAt: string | null
}

export type PairingStatus = {
  pairingToken: string
  paired: boolean
  lastConnectedAt: string | null
}
