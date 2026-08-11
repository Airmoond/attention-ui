import type { ContextKind, PreferenceState, ToolId } from "@focus-ui/shared"
import { describe, expect, it } from "vitest"
import { getLocalToolById, type LocalTool } from "./local-policy"
import { getPreferenceScore, sortToolsByPreference } from "./habit-sorter"

const tools = (...toolIds: ToolId[]): LocalTool[] => toolIds.map(getLocalToolById)

const preferences = (
  contextKind: ContextKind,
  counts: Partial<Record<ToolId, number>>,
  globalCounts: Partial<Record<ToolId, number>> = counts
): PreferenceState => ({
  globalToolCount: globalCounts,
  contextToolCount: { [contextKind]: counts },
  lastUsedAt: {},
  pinnedTools: []
})

const ids = (result: LocalTool[]): ToolId[] => result.map((tool) => tool.id)

describe("habit sorter", () => {
  it("keeps the default order below three contextual uses", () => {
    const defaults = tools("chart", "explain", "extract")
    const state = preferences("numbers", { extract: 2 })

    expect(ids(sortToolsByPreference(defaults, "numbers", state))).toEqual([
      "chart",
      "explain",
      "extract"
    ])
  })

  it("uses the 0.7 context and 0.3 global score after three uses", () => {
    const state = preferences("numbers", { chart: 3 }, { chart: 4 })
    expect(getPreferenceScore("chart", "numbers", state)).toBeCloseTo(3.3)
    expect(
      ids(sortToolsByPreference(tools("explain", "chart", "extract"), "numbers", state))
    ).toEqual(["chart", "explain", "extract"])
  })

  it("moves a preferred tool by only one position per sort", () => {
    const defaults = tools("chart", "explain", "extract")
    const state = preferences("numbers", { extract: 20 })

    expect(ids(sortToolsByPreference(defaults, "numbers", state))).toEqual([
      "chart",
      "extract",
      "explain"
    ])
  })

  it("does not use another context's records to reorder tools", () => {
    const state = preferences("numbers", { explain: 30 }, { explain: 30 })

    expect(ids(sortToolsByPreference(tools("ask", "explain"), "code", state))).toEqual([
      "ask",
      "explain"
    ])
  })

  it("never adds a tool that is absent from the allowed set", () => {
    const state = preferences("numbers", { chart: 100, extract: 100 })
    expect(ids(sortToolsByPreference(tools("summarize", "ask"), "numbers", state))).toEqual([
      "summarize",
      "ask"
    ])
  })

  it("returns the default order after preferences are reset", () => {
    const defaults = tools("chart", "explain", "extract")
    const emptyState: PreferenceState = {
      globalToolCount: {},
      contextToolCount: {},
      lastUsedAt: {},
      pinnedTools: []
    }
    expect(ids(sortToolsByPreference(defaults, "numbers", emptyState))).toEqual([
      "chart",
      "explain",
      "extract"
    ])
  })
})
