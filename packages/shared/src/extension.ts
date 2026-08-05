import { z } from "zod"
import type {
  ApiError,
  AuthCheckResponse,
  DesktopConnectionStatus,
  ExtensionSettings,
  HealthResponse,
  PairRequest,
  PairResponse
} from "./types"

export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  desktopBaseUrl: "http://127.0.0.1:17321",
  clientToken: null,
  enabled: true
}

export const PairRequestSchema = z
  .object({
    pairingToken: z.string().trim().min(1).max(64)
  })
  .strict()

export const PairResponseSchema = z
  .object({
    ok: z.literal(true),
    clientToken: z.string().min(20).max(200)
  })
  .strict()

export const ApiErrorSchema = z
  .object({
    ok: z.literal(false),
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(300)
  })
  .strict()

export const HealthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.literal("focusui-desktop"),
    version: z.string().min(1).max(50),
    aiConfigured: z.boolean()
  })
  .strict()

export const AuthCheckResponseSchema = z
  .object({
    ok: z.literal(true),
    authenticated: z.literal(true)
  })
  .strict()

export const ExtensionSettingsSchema = z
  .object({
    desktopBaseUrl: z.union([
      z.literal("http://127.0.0.1:17321"),
      z.literal("http://localhost:17321")
    ]),
    clientToken: z.string().min(20).max(200).nullable(),
    enabled: z.boolean()
  })
  .strict()

export type {
  ApiError,
  AuthCheckResponse,
  DesktopConnectionStatus,
  ExtensionSettings,
  HealthResponse,
  PairRequest,
  PairResponse
}
