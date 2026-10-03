import {
  AttentionUIErrorCodeSchema,
  getAttentionUIErrorMessage,
  type AttentionUIErrorCode
} from "@attention-ui/shared"
import type { BackgroundMessageResult } from "../communication/messages"

const TRANSPORT_ERROR_CODES: Readonly<Record<string, AttentionUIErrorCode>> = {
  REQUEST_TIMEOUT: "DESKTOP_OFFLINE",
  AI_REQUEST_TIMEOUT: "AI_TIMEOUT",
  DESKTOP_UNREACHABLE: "DESKTOP_OFFLINE",
  MISSING_CLIENT_TOKEN: "NOT_PAIRED",
  MISSING_AUTHORIZATION: "NOT_PAIRED",
  INVALID_CLIENT_TOKEN: "AUTH_EXPIRED",
  INVALID_AUTHORIZATION: "AUTH_EXPIRED",
  INVALID_DESKTOP_RESPONSE: "AI_INVALID_RESPONSE"
}

const TRANSPORT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  BACKGROUND_UNAVAILABLE: "AttentionUI插件已更新，请刷新当前网页后重试",
  BACKGROUND_REQUEST_FAILED: "AttentionUI插件请求处理失败，请重试",
  DESKTOP_REQUEST_FAILED: "Desktop在线，但本次工具请求失败，请重试"
}

const RETRYABLE_ERROR_CODES = new Set<AttentionUIErrorCode>([
  "DESKTOP_OFFLINE",
  "AI_TIMEOUT",
  "AI_PROVIDER_ERROR",
  "AI_INVALID_RESPONSE",
  "UNKNOWN_ERROR"
])

export const getToolRequestErrorCode = (
  result: BackgroundMessageResult
): AttentionUIErrorCode => {
  if ("toolId" in result && !result.success && result.errorCode) {
    return result.errorCode
  }
  if (!("ok" in result) || result.ok) {
    return "UNKNOWN_ERROR"
  }

  const sharedCode = AttentionUIErrorCodeSchema.safeParse(result.code)
  if (sharedCode.success) {
    return sharedCode.data
  }
  return TRANSPORT_ERROR_CODES[result.code] ?? "UNKNOWN_ERROR"
}

export const getToolRequestErrorMessage = (
  result: BackgroundMessageResult
): string => {
  if ("ok" in result && !result.ok) {
    const transportMessage = TRANSPORT_ERROR_MESSAGES[result.code]
    if (transportMessage) {
      return transportMessage
    }
  }
  return getAttentionUIErrorMessage(getToolRequestErrorCode(result))
}

export const isRetryableAttentionUIError = (code: AttentionUIErrorCode): boolean =>
  RETRYABLE_ERROR_CODES.has(code)
