import { TOOL_IDS, ToolIdSchema, type ContextKind, type PageContext } from "@focus-ui/shared"
import { describe, expect, it } from "vitest"
import { getLocalTools, MAX_LOCAL_TOOLS } from "./local-policy"

const createContext = (contextKind: ContextKind, text = "A concise semantic content block."): PageContext => ({
  url: "https://example.test/article",
  pageTitle: "Example",
  text,
  selectedText: null,
  nearbyHeading: null,
  contextKind,
  numericCandidates: []
})

describe("local tool policy", () => {
  it.each([
    ["text", ["summarize", "explain", "ask"]],
    ["numbers", ["chart", "explain", "extract"]],
    ["table", ["chart", "extract", "summarize"]],
    ["code", ["explain", "ask"]],
    ["unknown", ["summarize", "ask"]]
  ] satisfies Array<[ContextKind, string[]]>)('%s returns its stable default tools', (contextKind, expected) => {
    const first = getLocalTools(createContext(contextKind))
    const second = getLocalTools(createContext(contextKind))

    expect(first.map(({ id }) => id)).toEqual(expected)
    expect(second).toEqual(first)
  })

  it("prioritizes focus for long-form text without exceeding the limit", () => {
    const tools = getLocalTools(createContext("text"), { isLongFormEnvironment: true })

    expect(tools.map(({ id }) => id)).toEqual(["focus", "summarize", "explain"])
    expect(tools).toHaveLength(MAX_LOCAL_TOOLS)
  })

  it("uses only schema-approved tool IDs and never returns more than three tools", () => {
    for (const contextKind of ["text", "numbers", "table", "code", "unknown"] as const) {
      const tools = getLocalTools(createContext(contextKind))
      expect(tools.length).toBeLessThanOrEqual(MAX_LOCAL_TOOLS)
      expect(tools.every(({ id }) => ToolIdSchema.safeParse(id).success)).toBe(true)
      expect(tools.every(({ id }) => TOOL_IDS.includes(id))).toBe(true)
    }
  })

  it("marks only focus as available offline", () => {
    const regularTools = [
      ...getLocalTools(createContext("text")),
      ...getLocalTools(createContext("numbers")),
      ...getLocalTools(createContext("table"))
    ]
    const focusTool = getLocalTools(createContext("text"), { isLongFormEnvironment: true })[0]

    expect(regularTools.every(({ availableOffline }) => availableOffline === false)).toBe(true)
    expect(focusTool).toEqual({ id: "focus", label: "专注", availableOffline: true })
  })
})
