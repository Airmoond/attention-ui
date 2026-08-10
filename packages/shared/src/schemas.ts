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

export const ToolPlanSchema = z
  .object({
    toolId: ToolIdSchema,
    reason: z.string().trim().min(1).max(100),
    confidence: z.number().min(0).max(1)
  })
  .strict()

export const PlanRequestSchema = z
  .object({
    pageContext: PageContextSchema
  })
  .strict()

export const PlanResponseSchema = z
  .object({
    source: z.enum(["ai", "local"]),
    plan: ToolPlanSchema
  })
  .strict()

export const ChartDataSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    labels: z.array(z.string().trim().min(1).max(100)).min(2).max(20),
    values: z.array(z.number().finite()).min(2).max(20),
    unit: z.string().trim().max(20).nullable()
  })
  .strict()
  .refine((value) => value.labels.length === value.values.length, {
    message: "图表标签和值数量必须一致"
  })

export const ExtractedDataSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    items: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(100),
            value: z.union([z.string().max(500), z.number().finite(), z.null()])
          })
          .strict()
      )
      .min(1)
      .max(50)
  })
  .strict()

export const ExecuteRequestSchema = z
  .object({
    toolId: ToolIdSchema,
    pageContext: PageContextSchema,
    question: z.string().trim().min(1).max(500).nullable().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.toolId === "ask" && !value.question) {
      context.addIssue({
        code: "custom",
        path: ["question"],
        message: "提问工具必须提供问题"
      })
    }
  })

export const ToolResultSchema = z
  .object({
    toolId: ToolIdSchema,
    success: z.boolean(),
    content: z.string().trim().min(1).max(8_000),
    data: z.unknown().optional()
  })
  .strict()
