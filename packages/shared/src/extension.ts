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
    service: z.literal("attentionui-desktop"),
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

// Website controls are versioned separately so upgrading never overwrites pairing.
export const SiteOriginSchema = z.enum([
  "https://en.wikipedia.org", "https://zh.wikipedia.org", "https://baike.baidu.com",
  "http://127.0.0.1:8080", "http://localhost:8080",
  "http://127.0.0.1:17321", "http://localhost:17321"
])
export const SitePolicySchema = z.object({
  enabled: z.boolean(), autoToolbar: z.boolean(), autoAI: z.boolean()
}).strict()
export const SitePoliciesSchema = z.object({
  version: z.literal(1), sites: z.partialRecord(SiteOriginSchema, SitePolicySchema)
}).strict()
export const PageAccessSchema = z.object({
  origin: SiteOriginSchema.nullable(), globalEnabled: z.boolean(),
  enabled: z.boolean(), autoToolbar: z.boolean(), autoAI: z.boolean(),
  paused: z.boolean(), permission: z.boolean(), active: z.boolean()
}).strict()
export type SiteOrigin = z.infer<typeof SiteOriginSchema>
export type SitePolicy = z.infer<typeof SitePolicySchema>
export type PageAccess = z.infer<typeof PageAccessSchema>
