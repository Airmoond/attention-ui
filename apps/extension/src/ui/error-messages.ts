import {
  FocusUIErrorCodeSchema,
  getFocusUIErrorMessage,
  type FocusUIErrorCode
} from "@focus-ui/shared"
import type { BackgroundMessageResult } from "../communication/messages"

const TRANSPORT_ERROR_CODES: Readonly<Record<string, FocusUIErrorCode>> = {
  REQUEST_TIMEOUT: "DESKTOP_OFFLINE",
  DESKTOP_UNREACHABLE: "DESKTOP_OFFLINE",
  BACKGROUND_UNAVAILABLE: "DESKTOP_OFFLINE",
  BACKGROUND_REQUEST_FAILED: "DESKTOP_OFFLINE",
  MISSING_CLIENT_TOKEN: "NOT_PAIRED",
  MISSING_AUTHORIZATION: "NOT_PAIRED",
  INVALID_CLIENT_TOKEN: "AUTH_EXPIRED",
  INVALID_AUTHORIZATION: "AUTH_EXPIRED",
  INVALID_DESKTOP_RESPONSE: "AI_INVALID_RESPONSE"
}

const RETRYABLE_ERROR_CODES = new Set<FocusUIErrorCode>([
  "DESKTOP_OFFLINE",
  "AI_TIMEOUT",
  "AI_PROVIDER_ERROR",
  "AI_INVALID_RESPONSE",
  "UNKNOWN_ERROR"
])

export const getToolRequestErrorCode = (
  result: BackgroundMessageResult
): FocusUIErrorCode => {
  if ("toolId" in result && !result.success && result.errorCode) {
    return result.errorCode
  }
  if (!("ok" in result) || result.ok) {
    return "UNKNOWN_ERROR"
  }

  const sharedCode = FocusUIErrorCodeSchema.safeParse(result.code)
  if (sharedCode.success) {
    return sharedCode.data
  }
  return TRANSPORT_ERROR_CODES[result.code] ?? "UNKNOWN_ERROR"
}

export const getToolRequestErrorMessage = (
  result: BackgroundMessageResult
): string => getFocusUIErrorMessage(getToolRequestErrorCode(result))

export const isRetryableFocusUIError = (code: FocusUIErrorCode): boolean =>
  RETRYABLE_ERROR_CODES.has(code)
