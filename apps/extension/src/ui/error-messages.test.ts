import type { AttentionUIErrorCode } from "@attention-ui/shared"
import { describe, expect, it } from "vitest"
import type { BackgroundMessageResult } from "../communication/messages"
import {
  getToolRequestErrorCode,
  getToolRequestErrorMessage,
  isRetryableAttentionUIError
} from "./error-messages"

const apiError = (code: string): BackgroundMessageResult => ({
  ok: false,
  code,
  message: "TypeError: fetch failed with private provider details"
})

const toolFailure = (errorCode: AttentionUIErrorCode): BackgroundMessageResult => ({
  toolId: errorCode === "CHART_UNAVAILABLE" ? "chart" : "summarize",
  success: false,
  content: "ZodError: private raw response",
  errorCode
})

describe("unified user error messages", () => {
  it.each([
    ["DESKTOP_UNREACHABLE", "DESKTOP_OFFLINE", "AttentionUI Desktop未连接"],
    ["MISSING_CLIENT_TOKEN", "NOT_PAIRED", "尚未与AttentionUI Desktop配对"],
    ["INVALID_CLIENT_TOKEN", "AUTH_EXPIRED", "配对已失效，请重新连接AttentionUI Desktop"]
  ] as const)("maps %s to %s", (transportCode, expectedCode, expectedMessage) => {
    const result = apiError(transportCode)
    expect(getToolRequestErrorCode(result)).toBe(expectedCode)
    expect(getToolRequestErrorMessage(result)).toBe(expectedMessage)
  })

  it.each([
    ["AI_NOT_CONFIGURED", "请先在桌面端配置AI服务"],
    ["AI_TIMEOUT", "AI响应超时，请稍后重试"],
    ["AI_AUTH_FAILED", "AI服务连接失败，请检查桌面端配置"],
    ["AI_PROVIDER_ERROR", "AI服务暂时不可用，请稍后重试"],
    ["AI_INVALID_RESPONSE", "AI返回了无法处理的结果"],
    ["CHART_UNAVAILABLE", "当前内容无法可靠生成图表"],
    ["UNKNOWN_ERROR", "操作失败，请重试"]
  ] as const)("shows a safe message for %s", (errorCode, expectedMessage) => {
    const message = getToolRequestErrorMessage(toolFailure(errorCode))
    expect(message).toBe(expectedMessage)
    expect(message).not.toMatch(/ZodError|TypeError|https?:\/\//u)
  })

  it("allows only explicit user-driven retries for retryable failures", () => {
    expect(isRetryableAttentionUIError("AI_TIMEOUT")).toBe(true)
    expect(isRetryableAttentionUIError("AI_PROVIDER_ERROR")).toBe(true)
    expect(isRetryableAttentionUIError("NOT_PAIRED")).toBe(false)
    expect(isRetryableAttentionUIError("AI_AUTH_FAILED")).toBe(false)
    expect(isRetryableAttentionUIError("CHART_UNAVAILABLE")).toBe(false)
  })
})
