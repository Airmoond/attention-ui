import {
  ApiErrorSchema,
  PageAccessSchema,
  SitePolicySchema,
  ExtensionSettingsSchema,
  HealthResponseSchema,
  type ApiError,
  type DesktopConnectionStatus
} from "@focus-ui/shared/extension"
import {
  ExecuteRequestSchema,
  PageContextSchema,
  PlanResponseSchema,
  PreferencesResponseSchema,
  ToolEventResponseSchema,
  ToolEventSchema,
  ToolResultSchema,
  type PlanResponse,
  type PreferencesResponse,
  type ToolEventResponse,
  type ToolResult
} from "@focus-ui/shared"
import { z } from "zod"

const ConnectionStatusSchema = z.enum([
  "unknown",
  "offline",
  "online_unpaired",
  "online_paired",
  "auth_expired"
] satisfies DesktopConnectionStatus[])

const SettingsUpdateSchema = ExtensionSettingsSchema.pick({
  desktopBaseUrl: true,
  enabled: true
})
  .partial()
  .refine((value) => value.desktopBaseUrl !== undefined || value.enabled !== undefined, {
    message: "至少需要提供一项设置"
  })

export const ExtensionMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GET_PAGE_ACCESS") }).strict(),
  z.object({ type: z.literal("GET_TAB_ACCESS"), tabId: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal("SET_SITE_POLICY"), tabId: z.number().int().nonnegative(), policy: SitePolicySchema }).strict(),
  z.object({ type: z.literal("SET_TAB_PAUSED"), tabId: z.number().int().nonnegative(), paused: z.boolean() }).strict(),
  z.object({ type: z.literal("SHOW_SELECTION"), tabId: z.number().int().nonnegative() }).strict(),
  z.object({ type: z.literal("CHECK_DESKTOP_HEALTH") }).strict(),
  z.object({ type: z.literal("GET_CONNECTION_STATUS") }).strict(),
  z.object({ type: z.literal("PAIR_DESKTOP"), pairingToken: z.string().trim().min(1).max(64) }).strict(),
  z.object({ type: z.literal("GET_EXTENSION_SETTINGS") }).strict(),
  z.object({ type: z.literal("UPDATE_EXTENSION_SETTINGS"), settings: SettingsUpdateSchema }).strict(),
  z.object({ type: z.literal("CLEAR_LOCAL_PAIRING") }).strict(),
  z.object({ type: z.literal("PLAN_TOOLS"), pageContext: PageContextSchema }).strict(),
  z.object({ type: z.literal("EXECUTE_TOOL"), request: ExecuteRequestSchema }).strict(),
  z.object({ type: z.literal("RECORD_TOOL_EVENT"), event: ToolEventSchema }).strict(),
  z.object({ type: z.literal("GET_PREFERENCES") }).strict()
])

export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>

export const ConnectionStatusResultSchema = z
  .object({
    ok: z.literal(true),
    connectionStatus: ConnectionStatusSchema,
    health: HealthResponseSchema.nullable(),
    message: z.string().max(300).nullable()
  })
  .strict()

export type ConnectionStatusResult = z.infer<typeof ConnectionStatusResultSchema>

export const SettingsResultSchema = z
  .object({
    ok: z.literal(true),
    settings: ExtensionSettingsSchema
  })
  .strict()

export const AccessResultSchema = z.object({ ok: z.literal(true), access: PageAccessSchema }).strict()

export const BackgroundMessageResultSchema = z.union([
  AccessResultSchema,
  ConnectionStatusResultSchema,
  SettingsResultSchema,
  PlanResponseSchema,
  ToolResultSchema,
  ToolEventResponseSchema,
  PreferencesResponseSchema,
  ApiErrorSchema
])

export type BackgroundMessageResult = z.infer<typeof BackgroundMessageResultSchema>

type ConnectionMessage = Extract<
  ExtensionMessage,
  { type: "CHECK_DESKTOP_HEALTH" | "GET_CONNECTION_STATUS" | "PAIR_DESKTOP" }
>
type SettingsMessage = Extract<
  ExtensionMessage,
  {
    type:
      | "GET_EXTENSION_SETTINGS"
      | "UPDATE_EXTENSION_SETTINGS"
      | "CLEAR_LOCAL_PAIRING"
  }
>
type PlanMessage = Extract<ExtensionMessage, { type: "PLAN_TOOLS" }>
type ExecuteMessage = Extract<ExtensionMessage, { type: "EXECUTE_TOOL" }>
type ToolEventMessage = Extract<ExtensionMessage, { type: "RECORD_TOOL_EVENT" }>
type PreferencesMessage = Extract<ExtensionMessage, { type: "GET_PREFERENCES" }>

export function sendExtensionMessage(message: Extract<ExtensionMessage, { type: "GET_PAGE_ACCESS" | "GET_TAB_ACCESS" | "SET_SITE_POLICY" | "SET_TAB_PAUSED" }>): Promise<z.infer<typeof AccessResultSchema> | ApiError>
export function sendExtensionMessage(message: Extract<ExtensionMessage, { type: "SHOW_SELECTION" }>): Promise<ToolEventResponse | ApiError>
export function sendExtensionMessage(
  message: ConnectionMessage
): Promise<ConnectionStatusResult | ApiError>
export function sendExtensionMessage(message: SettingsMessage): Promise<z.infer<typeof SettingsResultSchema> | ApiError>
export function sendExtensionMessage(message: PlanMessage): Promise<PlanResponse | ApiError>
export function sendExtensionMessage(message: ExecuteMessage): Promise<ToolResult | ApiError>
export function sendExtensionMessage(message: ToolEventMessage): Promise<ToolEventResponse | ApiError>
export function sendExtensionMessage(message: PreferencesMessage): Promise<PreferencesResponse | ApiError>
export async function sendExtensionMessage(
  message: ExtensionMessage
): Promise<BackgroundMessageResult> {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message)
    const parsedResponse = BackgroundMessageResultSchema.safeParse(response)
    if (parsedResponse.success) {
      return parsedResponse.data
    }
  } catch (_error: unknown) {
    return {
      ok: false,
      code: "BACKGROUND_UNAVAILABLE",
      message: "FocusUI 后台服务不可用，请重新加载插件"
    }
  }

  return {
    ok: false,
    code: "BACKGROUND_UNAVAILABLE",
    message: "FocusUI 后台服务不可用，请重新加载插件"
  }
}
