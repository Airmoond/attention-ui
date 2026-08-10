import {
  ApiErrorSchema,
  AuthCheckResponseSchema,
  HealthResponseSchema,
  PairResponseSchema,
  type ApiError,
  type AuthCheckResponse,
  type HealthResponse,
  type PairResponse
} from "@focus-ui/shared/extension"
import {
  PlanResponseSchema,
  ToolResultSchema,
  type ExecuteRequest,
  type PageContext,
  type PlanResponse,
  type ToolResult
} from "@focus-ui/shared"
import type { z } from "zod"
import { getExtensionSettings } from "../storage/extension-store"

const REQUEST_TIMEOUT_MS = 4000

type JsonSchema<T> = z.ZodType<T>

export type DesktopRequestFailure = {
  ok: false
  error: ApiError
  status: number | null
}

export type DesktopRequestSuccess<T> = {
  ok: true
  data: T
}

export type DesktopRequestResult<T> = DesktopRequestSuccess<T> | DesktopRequestFailure

const requestFailure = (code: string, message: string, status: number | null): DesktopRequestFailure => ({
  ok: false,
  error: { ok: false, code, message },
  status
})

const requestDesktopJson = async <T>(
  path: "/health" | "/v1/pair" | "/v1/auth-check" | "/v1/plan" | "/v1/execute",
  schema: JsonSchema<T>,
  options: { method: "GET" } | { method: "POST"; body: unknown },
  requiresAuthentication: boolean
): Promise<DesktopRequestResult<T>> => {
  const settings = await getExtensionSettings()
  if (requiresAuthentication && !settings.clientToken) {
    return requestFailure("MISSING_CLIENT_TOKEN", "尚未完成桌面端配对", null)
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.method === "POST") {
    headers["Content-Type"] = "application/json"
  }
  if (requiresAuthentication && settings.clientToken) {
    headers.Authorization = `Bearer ${settings.clientToken}`
  }

  try {
    const response = await fetch(`${settings.desktopBaseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.method === "POST" ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    })
    const responseText = await response.text()
    let responseJson: unknown
    try {
      responseJson = JSON.parse(responseText)
    } catch (_error: unknown) {
      return requestFailure("INVALID_DESKTOP_RESPONSE", "桌面端返回了无效响应", response.status)
    }

    if (!response.ok) {
      const parsedError = ApiErrorSchema.safeParse(responseJson)
      return parsedError.success
        ? { ok: false, error: parsedError.data, status: response.status }
        : requestFailure("DESKTOP_REQUEST_FAILED", "桌面端请求失败", response.status)
    }

    const parsedResponse = schema.safeParse(responseJson)
    return parsedResponse.success
      ? { ok: true, data: parsedResponse.data }
      : requestFailure("INVALID_DESKTOP_RESPONSE", "桌面端返回了无效响应", response.status)
  } catch (error: unknown) {
    return requestFailure(
      error instanceof DOMException && error.name === "AbortError"
        ? "REQUEST_TIMEOUT"
        : "DESKTOP_UNREACHABLE",
      error instanceof DOMException && error.name === "AbortError"
        ? "连接桌面端超时"
        : "无法连接桌面端",
      null
    )
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export const checkDesktopHealth = async (): Promise<DesktopRequestResult<HealthResponse>> =>
  requestDesktopJson("/health", HealthResponseSchema, { method: "GET" }, false)

export const pairDesktop = async (
  pairingToken: string
): Promise<DesktopRequestResult<PairResponse>> =>
  requestDesktopJson("/v1/pair", PairResponseSchema, { method: "POST", body: { pairingToken } }, false)

export const checkDesktopAuthentication = async (): Promise<
  DesktopRequestResult<AuthCheckResponse>
> => requestDesktopJson("/v1/auth-check", AuthCheckResponseSchema, { method: "GET" }, true)

export const planDesktopTools = async (
  pageContext: PageContext
): Promise<DesktopRequestResult<PlanResponse>> =>
  requestDesktopJson(
    "/v1/plan",
    PlanResponseSchema,
    { method: "POST", body: { pageContext } },
    true
  )

export const executeDesktopTool = async (
  request: ExecuteRequest
): Promise<DesktopRequestResult<ToolResult>> =>
  requestDesktopJson(
    "/v1/execute",
    ToolResultSchema,
    { method: "POST", body: request },
    true
  )

export { REQUEST_TIMEOUT_MS }
