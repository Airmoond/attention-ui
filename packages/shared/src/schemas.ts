import { z } from "zod"
import type { ToolId } from "./types"

export const AppSettingsSchema = z
  .object({
    apiBaseUrl: z.string(),
    apiKey: z.string(),
    modelName: z.string(),
    attentionDelayMs: z.number().int().min(300).max(3000),
    enableAI: z.boolean(),
    enableLocalTools: z.boolean(),
    enableFocusMode: z.boolean(),
    enableHabitLearning: z.boolean()
  })
  .strict()

export const AuthStateSchema = z
  .object({
    pairingToken: z.string().min(1).max(64),
    clientToken: z.string().min(20).max(200).nullable(),
    tokenVersion: z.number().int().min(0),
    lastConnectedAt: z.string().datetime().nullable()
  })
  .strict()

export const ContextKindSchema = z.enum(["text", "numbers", "table", "code", "unknown"])

export const TOOL_IDS = ["summarize", "explain", "ask", "chart", "extract", "focus"] as const satisfies readonly ToolId[]

export const ToolIdSchema = z.enum(TOOL_IDS)

export const NumericCandidateSchema = z
  .object({
    label: z.string().max(200),
    rawValue: z.string().min(1).max(80),
    value: z.number().finite().nullable()
  })
  .strict()

export const PageContextSchema = z
  .object({
    url: z.string().min(1).max(2048),
    pageTitle: z.string().max(200),
    text: z.string().min(1).max(1500),
    selectedText: z.string().min(1).max(1500).nullable(),
    nearbyHeading: z.string().min(1).max(200).nullable(),
    contextKind: ContextKindSchema,
    numericCandidates: z.array(NumericCandidateSchema).max(20)
  })
  .strict()
