import {
  ChartDataSchema,
  ToolPlanSchema,
  ToolResultSchema
} from "@attention-ui/shared"
import { describe, expect, it } from "vitest"

describe("module six schemas", () => {
  it("accepts a valid ToolPlan and rejects an unknown tool", () => {
    expect(
      ToolPlanSchema.safeParse({ toolId: "chart", reason: "数字内容", confidence: 0.8 }).success
    ).toBe(true)
    expect(
      ToolPlanSchema.safeParse({ toolId: "custom", reason: "unknown", confidence: 0.8 }).success
    ).toBe(false)
  })

  it("accepts a unified ToolResult and rejects an invalid tool", () => {
    expect(
      ToolResultSchema.safeParse({ toolId: "summarize", success: true, content: "摘要" }).success
    ).toBe(true)
    expect(
      ToolResultSchema.safeParse({ toolId: "script", success: true, content: "unsafe" }).success
    ).toBe(false)
  })

  it("rejects chart data with mismatched labels and values", () => {
    expect(
      ChartDataSchema.safeParse({
        title: "趋势",
        chartType: "line",
        labels: ["2024", "2025"],
        values: [100],
        unit: null
      }).success
    ).toBe(false)
  })
})
