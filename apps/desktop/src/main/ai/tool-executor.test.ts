import {
  ExecuteRequestSchema,
  TOOL_IDS,
  type ExecuteRequest,
  type PageContext,
  type ToolId
} from "@focus-ui/shared"
import { describe, expect, it, vi } from "vitest"
import { AiProviderError, type AiCompletionRequest, type AiProvider } from "./ai-provider"
import { createToolExecutor } from "./tool-executor"

const pageContext: PageContext = {
  url: "https://example.test/finance",
  pageTitle: "Finance",
  text: "2024年营收100亿元，2025年营收120亿元。",
  selectedText: null,
  nearbyHeading: "年度营收",
  contextKind: "numbers",
  numericCandidates: [
    { label: "年份", rawValue: "2024", value: 2024 },
    { label: "营收", rawValue: "100", value: 100 },
    { label: "年份", rawValue: "2025", value: 2025 },
    { label: "营收", rawValue: "120", value: 120 }
  ]
}

const requestFor = (toolId: ToolId): ExecuteRequest => ({
  toolId,
  pageContext,
  ...(toolId === "ask" ? { question: "增长了多少？" } : {})
})

const successfulProvider = (): AiProvider => ({
  complete: vi.fn(async (request: AiCompletionRequest): Promise<string> => {
    if (request.systemPrompt.includes("图表数据")) {
      return JSON.stringify({
        title: "年度营收",
        labels: ["2024", "2025"],
        values: [100, 120],
        unit: "亿元"
      })
    }
    if (request.systemPrompt.includes("结构化数据提取")) {
      return JSON.stringify({
        title: "年度营收",
        items: [
          { label: "2024年", value: 100 },
          { label: "2025年", value: 120 }
        ]
      })
    }
    return "与当前内容一致的AI文本结果"
  })
})

describe("tool executor", () => {
  it.each(TOOL_IDS)("provides a safe execution entry for %s", async (toolId) => {
    const executor = createToolExecutor(successfulProvider())

    await expect(executor.execute(requestFor(toolId))).resolves.toMatchObject({
      toolId,
      success: true
    })
  })

  it("rejects an unknown tool before dispatch", async () => {
    const executor = createToolExecutor(successfulProvider())

    await expect(
      executor.execute({ toolId: "delete-page", pageContext })
    ).rejects.toThrow("INVALID_EXECUTE_REQUEST")
    expect(
      ExecuteRequestSchema.safeParse({ toolId: "delete-page", pageContext }).success
    ).toBe(false)
  })

  it("returns a safe result when the AI provider fails", async () => {
    const executor = createToolExecutor({
      complete: vi.fn().mockRejectedValue(new AiProviderError("AI_AUTH_FAILED"))
    })

    await expect(executor.execute(requestFor("summarize"))).resolves.toEqual({
      toolId: "summarize",
      success: false,
      content: "AI服务连接失败"
    })
  })

  it("rejects chart values that are not grounded in numeric candidates", async () => {
    const executor = createToolExecutor({
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "fabricated",
          labels: ["2024", "2025"],
          values: [999, 1_000],
          unit: null
        })
      )
    })

    await expect(executor.execute(requestFor("chart"))).resolves.toEqual({
      toolId: "chart",
      success: false,
      content: "AI返回结果无法安全使用"
    })
  })

  it("uses a short in-memory cache for repeated non-question tools", async () => {
    const provider = successfulProvider()
    const executor = createToolExecutor(provider)

    await executor.execute(requestFor("summarize"))
    await executor.execute(requestFor("summarize"))
    expect(provider.complete).toHaveBeenCalledOnce()
  })
})

