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

export const AttentionUIErrorCodeSchema = z.enum([
  "DESKTOP_OFFLINE",
  "NOT_PAIRED",
  "AUTH_EXPIRED",
  "AI_NOT_CONFIGURED",
  "AI_TIMEOUT",
  "AI_AUTH_FAILED",
  "AI_PROVIDER_ERROR",
  "AI_INVALID_RESPONSE",
  "CHART_UNAVAILABLE",
  "UNKNOWN_ERROR"
])

export const ToolEventSchema = z
  .object({
    eventType: z.literal("tool_clicked"),
    contextType: ContextKindSchema,
    toolId: ToolIdSchema
  })
  .strict()

export const ToolEventResponseSchema = z.object({ ok: z.literal(true) }).strict()

const ToolCountSchema = z.partialRecord(
  ToolIdSchema,
  z.number().int().nonnegative().finite()
)

export const PreferenceStateSchema = z
  .object({
    globalToolCount: ToolCountSchema,
    contextToolCount: z.partialRecord(ContextKindSchema, ToolCountSchema),
    lastUsedAt: z.partialRecord(
      ToolIdSchema,
      z.number().int().nonnegative().finite()
    ),
    pinnedTools: z.array(ToolIdSchema).max(TOOL_IDS.length)
  })
  .strict()

export const PreferencesResponseSchema = z
  .object({
    ok: z.literal(true),
    preferences: PreferenceStateSchema
  })
  .strict()

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
    chartType: z.enum(["bar", "line"]),
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
    data: z.unknown().optional(),
    errorCode: AttentionUIErrorCodeSchema.optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.success && !value.errorCode) {
      context.addIssue({
        code: "custom",
        path: ["errorCode"],
        message: "失败的工具结果必须包含安全错误码"
      })
    }
    if (value.success && value.errorCode) {
      context.addIssue({
        code: "custom",
        path: ["errorCode"],
        message: "成功的工具结果不能包含错误码"
      })
    }

    if (!value.success && value.data !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["data"],
        message: "失败的工具结果不能包含执行数据"
      })
      return
    }

    if (value.toolId === "chart" && value.success) {
      if (!ChartDataSchema.safeParse(value.data).success) {
        context.addIssue({
          code: "custom",
          path: ["data"],
          message: "图表工具必须返回合法图表数据"
        })
      }
      return
    }

    if (value.toolId === "extract" && value.success) {
      if (!ExtractedDataSchema.safeParse(value.data).success) {
        context.addIssue({
          code: "custom",
          path: ["data"],
          message: "提取工具必须返回合法结构化数据"
        })
      }
      return
    }

    if (value.data !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["data"],
        message: "当前工具不允许携带任意执行数据"
      })
    }
  })
