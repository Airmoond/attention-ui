import { describe, expect, it } from "vitest"
import {
  PageContextSchema,
  PreferenceStateSchema,
  ToolPlanSchema,
  ToolResultSchema
} from "../src/schemas"

const validContext = {
  url: "https://example.test/article",
  pageTitle: "Example",
  text: "A useful paragraph.",
  selectedText: null,
  nearbyHeading: null,
  contextKind: "text" as const,
  numericCandidates: []
}

describe("ToolPlan schema boundaries", () => {
  const validPlan = { toolId: "chart", reason: "数字内容", confidence: 0.8 }

  it("accepts a valid allowlisted tool", () => {
    expect(ToolPlanSchema.safeParse(validPlan).success).toBe(true)
  })

  it("rejects unknown tools and extra fields", () => {
    expect(ToolPlanSchema.safeParse({ ...validPlan, toolId: "script" }).success).toBe(false)
    expect(ToolPlanSchema.safeParse({ ...validPlan, javascript: "alert(1)" }).success).toBe(false)
  })

  it("accepts confidence endpoints and rejects out-of-range values", () => {
    expect(ToolPlanSchema.safeParse({ ...validPlan, confidence: 0 }).success).toBe(true)
    expect(ToolPlanSchema.safeParse({ ...validPlan, confidence: 1 }).success).toBe(true)
    expect(ToolPlanSchema.safeParse({ ...validPlan, confidence: -0.01 }).success).toBe(false)
    expect(ToolPlanSchema.safeParse({ ...validPlan, confidence: 1.01 }).success).toBe(false)
  })
})

describe("ToolResult schema boundaries", () => {
  it("accepts safe text and structured chart results", () => {
    expect(
      ToolResultSchema.safeParse({ toolId: "summarize", success: true, content: "摘要" }).success
    ).toBe(true)
    expect(
      ToolResultSchema.safeParse({
        toolId: "chart",
        success: true,
        content: "已生成图表",
        data: {
          title: "年度营收",
          chartType: "bar",
          labels: ["2024", "2025"],
          values: [105, 136],
          unit: "亿元"
        }
      }).success
    ).toBe(true)
  })

  it("rejects unknown tools and error codes", () => {
    expect(
      ToolResultSchema.safeParse({ toolId: "script", success: true, content: "unsafe" }).success
    ).toBe(false)
    expect(
      ToolResultSchema.safeParse({
        toolId: "summarize",
        success: false,
        content: "失败",
        errorCode: "RAW_PROVIDER_ERROR"
      }).success
    ).toBe(false)
  })

  it("rejects arbitrary execution data and data on failures", () => {
    expect(
      ToolResultSchema.safeParse({
        toolId: "summarize",
        success: true,
        content: "unsafe",
        data: { javascript: "alert(1)" }
      }).success
    ).toBe(false)
    expect(
      ToolResultSchema.safeParse({
        toolId: "chart",
        success: false,
        content: "失败",
        errorCode: "CHART_UNAVAILABLE",
        data: { labels: ["hidden"] }
      }).success
    ).toBe(false)
  })
})

describe("PageContext privacy boundaries", () => {
  it("accepts exact text and selection limits and rejects overflow", () => {
    expect(PageContextSchema.safeParse({ ...validContext, text: "x".repeat(1500) }).success).toBe(true)
    expect(PageContextSchema.safeParse({ ...validContext, text: "x".repeat(1501) }).success).toBe(false)
    expect(PageContextSchema.safeParse({ ...validContext, selectedText: "x".repeat(1500) }).success).toBe(true)
    expect(PageContextSchema.safeParse({ ...validContext, selectedText: "x".repeat(1501) }).success).toBe(false)
  })

  it("accepts twenty candidates and rejects overflow or non-finite values", () => {
    const candidates = Array.from({ length: 20 }, (_, index) => ({
      label: `value ${index}`,
      rawValue: String(index),
      value: index
    }))
    expect(PageContextSchema.safeParse({ ...validContext, numericCandidates: candidates }).success).toBe(true)
    expect(
      PageContextSchema.safeParse({
        ...validContext,
        numericCandidates: [...candidates, { label: "overflow", rawValue: "21", value: 21 }]
      }).success
    ).toBe(false)
    expect(
      PageContextSchema.safeParse({
        ...validContext,
        numericCandidates: [{ label: "invalid", rawValue: "NaN", value: Number.NaN }]
      }).success
    ).toBe(false)
  })
})

describe("PreferenceState schema boundaries", () => {
  const validPreferences = {
    globalToolCount: { chart: 3 },
    contextToolCount: { numbers: { chart: 3 } },
    lastUsedAt: { chart: 1 },
    pinnedTools: []
  }

  it("accepts valid allowlisted counters", () => {
    expect(PreferenceStateSchema.safeParse(validPreferences).success).toBe(true)
  })

  it("rejects illegal tools, negative counts, and invalid context kinds", () => {
    expect(PreferenceStateSchema.safeParse({ ...validPreferences, globalToolCount: { script: 1 } }).success).toBe(false)
    expect(PreferenceStateSchema.safeParse({ ...validPreferences, globalToolCount: { chart: -1 } }).success).toBe(false)
    expect(
      PreferenceStateSchema.safeParse({ ...validPreferences, contextToolCount: { video: { chart: 3 } } }).success
    ).toBe(false)
  })
})
