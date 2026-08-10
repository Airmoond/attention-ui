import { createHash } from "node:crypto"
import {
  ChartDataSchema,
  ExecuteRequestSchema,
  ExtractedDataSchema,
  ToolResultSchema,
  type ChartData,
  type ExecuteRequest,
  type ExtractedData,
  type PageContext,
  type ToolId,
  type ToolResult
} from "@focus-ui/shared"
import { AiProviderError, type AiProvider } from "./ai-provider"

const MAX_RESULT_CHARACTERS = 8_000
const RESULT_CACHE_TTL_MS = 2 * 60 * 1_000
const MAX_CACHE_ENTRIES = 25

type CachedResult = {
  expiresAt: number
  result: ToolResult
}

type ToolHandler = (request: ExecuteRequest) => Promise<ToolResult>

export type ToolExecutor = {
  execute: (request: unknown) => Promise<ToolResult>
}

const truncate = (text: string, maximumLength: number): string =>
  Array.from(text).slice(0, maximumLength).join("")

const parseJson = (content: string): unknown => {
  try {
    return JSON.parse(content)
  } catch (_error: unknown) {
    throw new AiProviderError("AI_INVALID_RESPONSE")
  }
}

const valueMatchesCandidate = (value: number, pageContext: PageContext): boolean =>
  pageContext.numericCandidates.some((candidate) => {
    if (candidate.value === null) {
      return false
    }
    const tolerance = Math.max(1e-9, Math.abs(value) * 1e-9)
    return Math.abs(candidate.value - value) <= tolerance
  })

const parseChartData = (content: string, pageContext: PageContext): ChartData => {
  const parsed = ChartDataSchema.safeParse(parseJson(content))
  if (
    !parsed.success ||
    !parsed.data.values.every((value) => valueMatchesCandidate(value, pageContext))
  ) {
    throw new AiProviderError("AI_INVALID_RESPONSE")
  }
  return parsed.data
}

const parseExtractedData = (content: string, pageContext: PageContext): ExtractedData => {
  const parsed = ExtractedDataSchema.safeParse(parseJson(content))
  if (!parsed.success) {
    throw new AiProviderError("AI_INVALID_RESPONSE")
  }

  const valuesAreGrounded = parsed.data.items.every(({ value }) => {
    if (typeof value === "number") {
      return valueMatchesCandidate(value, pageContext)
    }
    if (typeof value === "string") {
      return pageContext.text.includes(value)
    }
    return true
  })
  if (!valuesAreGrounded) {
    throw new AiProviderError("AI_INVALID_RESPONSE")
  }
  return parsed.data
}

const safeFailureContent = (error: unknown): string =>
  error instanceof AiProviderError && error.code === "AI_NOT_CONFIGURED"
    ? "请先在桌面端配置AI服务"
    : error instanceof AiProviderError && error.code === "AI_INVALID_RESPONSE"
      ? "AI返回结果无法安全使用"
      : "AI服务连接失败"

const makeResult = (
  toolId: ToolId,
  success: boolean,
  content: string,
  data?: unknown
): ToolResult =>
  ToolResultSchema.parse({
    toolId,
    success,
    content: truncate(content.trim(), MAX_RESULT_CHARACTERS) || "AI未返回可用内容",
    ...(data === undefined ? {} : { data })
  })

const contextPrompt = (request: ExecuteRequest): string =>
  JSON.stringify({
    pageContext: request.pageContext,
    ...(request.question ? { question: request.question } : {})
  })

const cacheKeyFor = (request: ExecuteRequest): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        toolId: request.toolId,
        pageContext: request.pageContext,
        question: request.question ?? null
      })
    )
    .digest("hex")

const isCacheable = (request: ExecuteRequest): boolean =>
  request.toolId !== "ask" && request.toolId !== "focus"

export const createToolExecutor = (provider: AiProvider): ToolExecutor => {
  const cache = new Map<string, CachedResult>()

  const completeText = async (
    request: ExecuteRequest,
    systemPrompt: string
  ): Promise<ToolResult> => {
    const content = await provider.complete({
      systemPrompt,
      userPrompt: contextPrompt(request)
    })
    return makeResult(request.toolId, true, content)
  }

  const handlers: Readonly<Record<ToolId, ToolHandler>> = {
    focus: async () => makeResult("focus", true, "专注模式已在浏览器本地打开"),
    summarize: async (request) =>
      completeText(
        request,
        "你是FocusUI总结工具。只总结提供的当前内容，不补充外部事实；保留关键数字和结论，使用简洁Markdown，不返回HTML或代码。"
      ),
    explain: async (request) =>
      completeText(
        request,
        "你是FocusUI解释工具。只解释提供的当前内容，先说明主旨，再解释必要术语；代码只解释结构和逻辑，不修改代码；使用安全纯文本或Markdown，不返回HTML。"
      ),
    ask: async (request) =>
      completeText(
        request,
        "你是FocusUI问答工具。仅根据提供的PageContext回答用户问题；信息不足时明确说明无法从当前内容确定，不假装访问其他网页部分，不返回HTML。"
      ),
    chart: async (request) => {
      const content = await provider.complete({
        systemPrompt:
          "你是FocusUI图表数据工具。只使用PageContext.numericCandidates中明确对应的原文数字，不猜测。仅返回JSON：{\"title\":string,\"labels\":string[],\"values\":number[],\"unit\":string|null}。标签和值必须一一对应，2到20组，不返回HTML或代码。",
        userPrompt: contextPrompt(request),
        jsonMode: true
      })
      const chartData = parseChartData(content, request.pageContext)
      return makeResult("chart", true, "已生成结构化图表数据", chartData)
    },
    extract: async (request) => {
      const content = await provider.complete({
        systemPrompt:
          "你是FocusUI结构化数据提取工具。只提取提供内容中真实存在的数据，不补造。仅返回JSON：{\"title\":string,\"items\":[{\"label\":string,\"value\":string|number|null}]}，不返回HTML或代码。",
        userPrompt: contextPrompt(request),
        jsonMode: true
      })
      const extractedData = parseExtractedData(content, request.pageContext)
      return makeResult("extract", true, "已提取结构化数据", extractedData)
    }
  }

  return {
    execute: async (input): Promise<ToolResult> => {
      const parsedRequest = ExecuteRequestSchema.safeParse(input)
      if (!parsedRequest.success) {
        throw new Error("INVALID_EXECUTE_REQUEST")
      }
      const request = parsedRequest.data
      const key = cacheKeyFor(request)
      const cached = cache.get(key)
      if (isCacheable(request) && cached && cached.expiresAt > Date.now()) {
        return cached.result
      }
      cache.delete(key)

      let result: ToolResult
      try {
        result = await handlers[request.toolId](request)
      } catch (error: unknown) {
        result = makeResult(request.toolId, false, safeFailureContent(error))
      }

      if (result.success && isCacheable(request)) {
        if (cache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = cache.keys().next().value
          if (oldestKey) {
            cache.delete(oldestKey)
          }
        }
        cache.set(key, { expiresAt: Date.now() + RESULT_CACHE_TTL_MS, result })
      }
      return result
    }
  }
}

export { MAX_CACHE_ENTRIES, RESULT_CACHE_TTL_MS }

