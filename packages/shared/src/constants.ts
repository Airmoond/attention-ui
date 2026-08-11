import type { AppSettings, FocusUIErrorCode } from "./types"

export const DEFAULT_APP_SETTINGS: AppSettings = {
  apiBaseUrl: "",
  apiKey: "",
  modelName: "",
  attentionDelayMs: 900,
  enableAI: true,
  enableLocalTools: true,
  enableFocusMode: true,
  enableHabitLearning: true
}

export const FOCUS_UI_ERROR_MESSAGES = {
  DESKTOP_OFFLINE: "FocusUI Desktop未连接",
  NOT_PAIRED: "尚未与FocusUI Desktop配对",
  AUTH_EXPIRED: "配对已失效，请重新连接FocusUI Desktop",
  AI_NOT_CONFIGURED: "请先在桌面端配置AI服务",
  AI_TIMEOUT: "AI响应超时，请稍后重试",
  AI_AUTH_FAILED: "AI服务连接失败，请检查桌面端配置",
  AI_PROVIDER_ERROR: "AI服务暂时不可用，请稍后重试",
  AI_INVALID_RESPONSE: "AI返回了无法处理的结果",
  CHART_UNAVAILABLE: "当前内容无法可靠生成图表",
  UNKNOWN_ERROR: "操作失败，请重试"
} as const satisfies Readonly<Record<FocusUIErrorCode, string>>

export const getFocusUIErrorMessage = (code: FocusUIErrorCode): string =>
  FOCUS_UI_ERROR_MESSAGES[code]
