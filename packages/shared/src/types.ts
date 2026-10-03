export type AppInfo = {
  version: string
  platform: string
  serviceRunning: boolean
}

export type HealthResponse = {
  ok: true
  service: "attentionui-desktop"
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

export type AiConnectionTestResult = {
  ok: boolean
  message: string
  errorCode?: AttentionUIErrorCode
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

export type ContextKind = "text" | "numbers" | "table" | "code" | "unknown"

export type ToolId = "summarize" | "explain" | "ask" | "chart" | "extract" | "focus"

export type AttentionUIErrorCode =
  | "DESKTOP_OFFLINE"
  | "NOT_PAIRED"
  | "AUTH_EXPIRED"
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_AUTH_FAILED"
  | "AI_PROVIDER_ERROR"
  | "AI_INVALID_RESPONSE"
  | "CHART_UNAVAILABLE"
  | "UNKNOWN_ERROR"

export type ToolEvent = {
  eventType: "tool_clicked"
  contextType: ContextKind
  toolId: ToolId
}

export type ToolEventResponse = {
  ok: true
}

export type PreferenceState = {
  globalToolCount: Partial<Record<ToolId, number>>
  contextToolCount: Partial<
    Record<ContextKind, Partial<Record<ToolId, number>>>
  >
  lastUsedAt: Partial<Record<ToolId, number>>
  pinnedTools: ToolId[]
}

export type PreferencesResponse = {
  ok: true
  preferences: PreferenceState
}

export type LogLevel = "info" | "warning" | "error"

export type LogMetadata = Record<string, string | number | boolean | null>

export type LogEntry = {
  id: string
  level: LogLevel
  event: string
  message: string
  timestamp: number
  metadata?: LogMetadata
}

export type ToolPlan = {
  toolId: ToolId
  reason: string
  confidence: number
}

export type NumericCandidate = {
  label: string
  rawValue: string
  value: number | null
}

export type PageContext = {
  url: string
  pageTitle: string
  text: string
  selectedText: string | null
  nearbyHeading: string | null
  contextKind: ContextKind
  numericCandidates: NumericCandidate[]
}

export type PlanRequest = {
  pageContext: PageContext
}

export type PlanResponse = {
  source: "ai" | "local"
  plan: ToolPlan
}

export type ChartData = {
  title: string
  chartType: "bar" | "line"
  labels: string[]
  values: number[]
  unit: string | null
}

export type ExtractedDataItem = {
  label: string
  value: string | number | null
}

export type ExtractedData = {
  title: string
  items: ExtractedDataItem[]
}

export type ExecuteRequest = {
  toolId: ToolId
  pageContext: PageContext
  question?: string | null
}

export type ToolResult = {
  toolId: ToolId
  success: boolean
  content: string
  data?: unknown
  errorCode?: AttentionUIErrorCode
}

export type PairingStatus = {
  pairingToken: string
  paired: boolean
  lastConnectedAt: string | null
}

export type OnboardingActionResult = {
  ok: boolean
  message: string
}
