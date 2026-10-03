import {
  ApiErrorSchema,
  AuthCheckResponseSchema,
  HealthResponseSchema,
  PairResponseSchema,
  type ApiError,
  type AuthCheckResponse,
  type HealthResponse,
  type PairResponse
} from "@attention-ui/shared/extension"
import {
  PlanResponseSchema,
  PreferencesResponseSchema,
  ToolEventResponseSchema,
  ToolResultSchema,
  type ExecuteRequest,
  type PageContext,
  type PlanResponse,
  type PreferencesResponse,
  type ToolEvent,
  type ToolEventResponse,
  type ToolResult
} from "@attention-ui/shared"
import type { z } from "zod"
import { getExtensionSettings } from "../storage/extension-store"

const REQUEST_TIMEOUT_MS = 20_000
const EXECUTE_REQUEST_TIMEOUT_MS = 30_000
const PREFERENCE_CACHE_TTL_MS = 10_000

type JsonSchema<T> = z.ZodType<T>

type DesktopRequestPolicy = {
  timeoutMs?: number
  timeoutCode?: string
  timeoutMessage?: string
}

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

let preferenceCache: { value: PreferencesResponse; expiresAt: number } | null = null

const requestFailure = (code: string, message: string, status: number | null): DesktopRequestFailure => ({
  ok: false,
  error: { ok: false, code, message },
  status
})

const requestDesktopJson = async <T>(
  path:
    | "/health"
    | "/v1/pair"
    | "/v1/auth-check"
    | "/v1/plan"
    | "/v1/execute"
    | "/v1/events"
    | "/v1/preferences",
  schema: JsonSchema<T>,
  options: { method: "GET" } | { method: "POST"; body: unknown },
  requiresAuthentication: boolean,
  policy: DesktopRequestPolicy = {}
): Promise<DesktopRequestResult<T>> => {
  const settings = await getExtensionSettings()
  if (requiresAuthentication && !settings.clientToken) {
    return requestFailure("MISSING_CLIENT_TOKEN", "尚未完成桌面端配对", null)
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    policy.timeoutMs ?? REQUEST_TIMEOUT_MS
  )
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
    const timedOut = error instanceof DOMException && error.name === "AbortError"
    return requestFailure(
      timedOut ? (policy.timeoutCode ?? "REQUEST_TIMEOUT") : "DESKTOP_UNREACHABLE",
      timedOut ? (policy.timeoutMessage ?? "连接桌面端超时") : "无法连接桌面端",
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
): Promise<DesktopRequestResult<ToolResult>> => {
  const result = await requestDesktopJson(
    "/v1/execute",
    ToolResultSchema,
    { method: "POST", body: request },
    true,
    {
      timeoutMs: EXECUTE_REQUEST_TIMEOUT_MS,
      timeoutCode: "AI_REQUEST_TIMEOUT",
      timeoutMessage: "AI响应超时"
    }
  )
  if (result.ok || result.error.code !== "DESKTOP_UNREACHABLE") {
    return result
  }

  const healthResult = await checkDesktopHealth()
  return healthResult.ok
    ? requestFailure("DESKTOP_REQUEST_FAILED", "桌面端在线，但本次工具请求失败", result.status)
    : result
}

export const recordDesktopToolEvent = async (
  event: ToolEvent
): Promise<DesktopRequestResult<ToolEventResponse>> => {
  const result = await requestDesktopJson(
    "/v1/events",
    ToolEventResponseSchema,
    { method: "POST", body: event },
    true
  )
  if (result.ok) {
    preferenceCache = null
  }
  return result
}

export const getDesktopPreferences = async (): Promise<
  DesktopRequestResult<PreferencesResponse>
> => {
  if (preferenceCache && preferenceCache.expiresAt > Date.now()) {
    return { ok: true, data: preferenceCache.value }
  }

  const result = await requestDesktopJson(
    "/v1/preferences",
    PreferencesResponseSchema,
    { method: "GET" },
    true
  )
  if (result.ok) {
    preferenceCache = {
      value: result.data,
      expiresAt: Date.now() + PREFERENCE_CACHE_TTL_MS
    }
  }
  return result
}

export const clearPreferenceCache = (): void => {
  preferenceCache = null
}

export { EXECUTE_REQUEST_TIMEOUT_MS, PREFERENCE_CACHE_TTL_MS, REQUEST_TIMEOUT_MS }
