import type { ContextKind, PageContext } from "@attention-ui/shared"
import { describe, expect, it, vi } from "vitest"
import type { AiProvider } from "./ai-provider"
import {
  createAiPlanner,
  parseToolPlan,
  sanitizePlannerContext
} from "./ai-planner"

const createContext = (contextKind: ContextKind): PageContext => ({
  url: "https://example.test",
  pageTitle: "Example",
  text: "Current focused content with enough detail.",
  selectedText: null,
  nearbyHeading: null,
  contextKind,
  numericCandidates:
    contextKind === "numbers"
      ? [
          { label: "2024", rawValue: "100", value: 100 },
          { label: "2025", rawValue: "120", value: 120 }
        ]
      : []
})

const providerReturning = (content: string): AiProvider => ({
  complete: vi.fn().mockResolvedValue(content)
})

describe("AI planner", () => {
  it("accepts a chart plan for numeric content", async () => {
    const planner = createAiPlanner({
      provider: providerReturning(
        JSON.stringify({ toolId: "chart", reason: "包含多个数字指标", confidence: 0.87 })
      )
    })

    await expect(planner.plan(createContext("numbers"))).resolves.toEqual({
      source: "ai",
      plan: { toolId: "chart", reason: "包含多个数字指标", confidence: 0.87 }
    })
  })

  it("accepts an explain plan for code", async () => {
    const planner = createAiPlanner({
      provider: providerReturning(
        JSON.stringify({ toolId: "explain", reason: "当前内容是代码", confidence: 0.9 })
      )
    })

    await expect(planner.plan(createContext("code"))).resolves.toMatchObject({
      source: "ai",
      plan: { toolId: "explain" }
    })
  })

  it.each([
    ["not json"],
    [JSON.stringify({ toolId: "delete-page", reason: "unsafe", confidence: 1 })]
  ])("falls back for malformed or unknown tool output", async (content) => {
    const planner = createAiPlanner({ provider: providerReturning(content) })

    await expect(planner.plan(createContext("numbers"))).resolves.toMatchObject({
      source: "local",
      plan: { toolId: "chart", confidence: 0.5 }
    })
  })

  it("strictly rejects non-JSON wrappers", () => {
    expect(() =>
      parseToolPlan('```json\n{"toolId":"chart","reason":"data","confidence":1}\n```')
    ).toThrow("AI计划不是合法JSON")
  })

  it("enforces the privacy limits before building the prompt", () => {
    const context = createContext("text")
    const safeContext = sanitizePlannerContext({
      ...context,
      text: "文".repeat(2_000),
      selectedText: "选".repeat(2_000),
      numericCandidates: Array.from({ length: 25 }, (_, index) => ({
        label: String(index),
        rawValue: String(index),
        value: index
      }))
    })

    expect(Array.from(safeContext.text)).toHaveLength(1_500)
    expect(Array.from(safeContext.selectedText ?? "")).toHaveLength(1_500)
    expect(safeContext.numericCandidates).toHaveLength(20)
  })
})

