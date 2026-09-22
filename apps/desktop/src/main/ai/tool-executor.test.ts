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
        chartType: "bar",
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
      content: "AI服务连接失败，请检查桌面端配置",
      errorCode: "AI_AUTH_FAILED"
    })
  })

  it("frames summary content as a task without exposing an internal context object", async () => {
    const provider = successfulProvider()
    const executor = createToolExecutor(provider)

    await executor.execute(requestFor("summarize"))
    const completionRequest = vi.mocked(provider.complete).mock.calls[0]?.[0]

    expect(completionRequest?.userPrompt).toContain("<关注内容>")
    expect(completionRequest?.userPrompt).toContain(pageContext.text)
    expect(completionRequest?.userPrompt).not.toContain('"pageContext"')
    expect(completionRequest?.systemPrompt).toContain("不要解释输入格式")
  })

  it("rejects chart values that are not grounded in numeric candidates", async () => {
    const executor = createToolExecutor({
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "fabricated",
          chartType: "bar",
          labels: ["2024", "2025"],
          values: [999, 1_000],
          unit: null
        })
      )
    })

    await expect(executor.execute(requestFor("chart"))).resolves.toEqual({
      toolId: "chart",
      success: false,
      content: "当前内容无法可靠生成图表",
      errorCode: "CHART_UNAVAILABLE"
    })
  })

  it.each([null, "亿元"])("rejects mixed-unit chart data when unit is %s", async (unit) => {
    const mixedUnitContext: PageContext = {
      ...pageContext,
      text: "2025年营收136亿元，第四季度利润29亿元，2025年用户增长率31.4%。",
      numericCandidates: [
        { label: "2025年营收", rawValue: "136", value: 136 },
        { label: "第四季度利润", rawValue: "29", value: 29 },
        { label: "2025年用户增长率", rawValue: "31.4%", value: 31.4 }
      ]
    }
    const executor = createToolExecutor({
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: "经营数据",
          chartType: "bar",
          labels: ["营收", "利润", "增长率"],
          values: [136, 29, 31.4],
          unit
        })
      )
    })

    await expect(executor.execute({ toolId: "chart", pageContext: mixedUnitContext })).resolves.toMatchObject({
      success: false,
      errorCode: "CHART_UNAVAILABLE"
    })
  })

  it("preserves unambiguous source units in extracted numeric values", async () => {
    const executor = createToolExecutor(successfulProvider())

    await expect(executor.execute(requestFor("extract"))).resolves.toMatchObject({
      success: true,
      data: {
        items: [
          { label: "2024年", value: "100亿元" },
          { label: "2025年", value: "120亿元" }
        ]
      }
    })
  })

  it.each([
    ["AI_NOT_CONFIGURED", "请先在桌面端配置AI服务"],
    ["AI_TIMEOUT", "AI响应超时，请稍后重试"],
    ["AI_PROVIDER_ERROR", "AI服务暂时不可用，请稍后重试"],
    ["AI_INVALID_RESPONSE", "AI返回了无法处理的结果"]
  ] as const)("maps %s to a safe result", async (errorCode, message) => {
    const executor = createToolExecutor({
      complete: vi.fn().mockRejectedValue(new AiProviderError(errorCode))
    })

    await expect(executor.execute(requestFor("summarize"))).resolves.toMatchObject({
      success: false,
      content: message,
      errorCode
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
