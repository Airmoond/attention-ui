import {
  ApiErrorSchema,
  ExtensionSettingsSchema,
  HealthResponseSchema,
  type DesktopConnectionStatus
} from "@focus-ui/shared/extension"
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
  z.object({ type: z.literal("CHECK_DESKTOP_HEALTH") }).strict(),
  z.object({ type: z.literal("GET_CONNECTION_STATUS") }).strict(),
  z.object({ type: z.literal("PAIR_DESKTOP"), pairingToken: z.string().trim().min(1).max(64) }).strict(),
  z.object({ type: z.literal("GET_EXTENSION_SETTINGS") }).strict(),
  z.object({ type: z.literal("UPDATE_EXTENSION_SETTINGS"), settings: SettingsUpdateSchema }).strict(),
  z.object({ type: z.literal("CLEAR_LOCAL_PAIRING") }).strict()
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

export const BackgroundMessageResultSchema = z.union([
  ConnectionStatusResultSchema,
  SettingsResultSchema,
  ApiErrorSchema
])

export type BackgroundMessageResult = z.infer<typeof BackgroundMessageResultSchema>

export const sendExtensionMessage = async (
  message: ExtensionMessage
): Promise<BackgroundMessageResult> => {
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
