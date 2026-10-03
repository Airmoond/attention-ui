import {
  PageContextSchema,
  ToolPlanSchema,
  type ContextKind,
  type PageContext,
  type PlanResponse,
  type ToolId,
  type ToolPlan
} from "@attention-ui/shared"
import type { AiProvider } from "./ai-provider"
import { appLogger } from "../logger/logger"

const MAX_CONTEXT_TEXT_LENGTH = 1_500
const MAX_NUMERIC_CANDIDATES = 20

const LOCAL_TOOL_BY_CONTEXT = {
  text: "summarize",
  numbers: "chart",
  table: "chart",
  code: "explain",
  unknown: "summarize"
} as const satisfies Readonly<Record<ContextKind, ToolId>>

const truncate = (text: string, maximumLength: number): string =>
  Array.from(text).slice(0, maximumLength).join("")

export const sanitizePlannerContext = (pageContext: PageContext): PageContext =>
  PageContextSchema.parse({
    ...pageContext,
    text: truncate(pageContext.text, MAX_CONTEXT_TEXT_LENGTH),
    selectedText: pageContext.selectedText
      ? truncate(pageContext.selectedText, MAX_CONTEXT_TEXT_LENGTH)
      : null,
    numericCandidates: pageContext.numericCandidates.slice(0, MAX_NUMERIC_CANDIDATES)
  })

export const getLocalFallbackPlan = (pageContext: PageContext): ToolPlan => ({
  toolId: LOCAL_TOOL_BY_CONTEXT[pageContext.contextKind],
  reason: "AI规划不可用，保留本地工具策略",
  confidence: 0.5
})

export const parseToolPlan = (content: string): ToolPlan => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(content)
  } catch (_error: unknown) {
    throw new Error("AI计划不是合法JSON")
  }
  return ToolPlanSchema.parse(parsedJson)
}

const PLANNER_SYSTEM_PROMPT = `你是AttentionUI的单次工具规划器。请根据用户当前关注的PageContext只选择一个最合适的工具。
你只能选择：summarize、explain、ask、chart、extract、focus。
禁止自定义或编造工具，禁止修改网页，禁止返回HTML、CSS、JavaScript或任何可执行代码。
仅返回JSON对象，格式为：{"toolId":"工具ID","reason":"不超过100字的原因","confidence":0到1之间的数字}。
数字或表格内容可以选择chart或extract；代码优先explain；文章内容优先summarize；短文本不要选择focus。`

export type AiPlannerOptions = {
  provider: AiProvider
  isAiEnabled?: () => boolean
}

export type AiPlanner = {
  plan: (pageContext: PageContext) => Promise<PlanResponse>
}

export const createAiPlanner = ({
  provider,
  isAiEnabled = () => true
}: AiPlannerOptions): AiPlanner => ({
  plan: async (pageContext): Promise<PlanResponse> => {
    const safeContext = sanitizePlannerContext(pageContext)
    if (!isAiEnabled()) {
      return { source: "local", plan: getLocalFallbackPlan(safeContext) }
    }

    try {
      const content = await provider.complete({
        systemPrompt: PLANNER_SYSTEM_PROMPT,
        userPrompt: JSON.stringify(safeContext),
        jsonMode: true
      })
      return { source: "ai", plan: parseToolPlan(content) }
    } catch (error: unknown) {
      appLogger.warning("AI_SCHEMA_FAILED", "AI规划不可用，已使用本地策略", {
        errorCode:
          typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "INVALID_TOOL_PLAN"
      })
      return { source: "local", plan: getLocalFallbackPlan(safeContext) }
    }
  }
})
