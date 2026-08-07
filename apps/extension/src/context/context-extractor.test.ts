import { PageContextSchema } from "@focus-ui/shared"
import { describe, expect, it } from "vitest"
import { classifyContent } from "./content-classifier"
import { extractNumericCandidates, parseNumericValue } from "./number-extractor"

describe("number extractor", () => {
  it("parses years, thousands separators, percentages, negatives, and currency", () => {
    expect(parseNumericValue("2024")).toBe(2024)
    expect(parseNumericValue("1,200")).toBe(1200)
    expect(parseNumericValue("15.6%")).toBe(15.6)
    expect(parseNumericValue("-32")).toBe(-32)
    expect(parseNumericValue("¥99.5")).toBe(99.5)
  })

  it("limits numeric candidates and preserves raw values", () => {
    const candidates = extractNumericCandidates("营收 ¥99.5，增长 15.6%，用户 1,200，亏损 -32。")
    expect(candidates.map((candidate) => candidate.rawValue)).toEqual(["¥99.5", "15.6%", "1,200", "-32"])
  })
})

describe("content classifier", () => {
  const element = {
    matches: () => false,
    querySelector: () => null
  } as unknown as HTMLElement
  const classify = (text: string, values: string[], kind: "paragraph" | "table" | "code" = "paragraph") =>
    classifyContent({
      element,
      semanticKind: kind,
      text,
      numericCandidates: values.map((rawValue) => ({ rawValue, label: "", value: parseNumericValue(rawValue) }))
    })

  it("classifies normal text and a lone year as text", () => {
    expect(classify("This is ordinary prose.", [])).toBe("text")
    expect(classify("The report was published in 2024.", ["2024"])).toBe("text")
  })

  it("classifies multiple meaningful values as numbers", () => {
    expect(classify("Revenue reached 1,200 and growth was 15.6%.", ["1,200", "15.6%"])).toBe("numbers")
  })

  it("prioritizes code and tables over numeric content", () => {
    expect(classify("const port = 17321;", ["17321", "1"], "code")).toBe("code")
    expect(classify("2024 1,200", ["2024", "1,200"], "table")).toBe("table")
  })
})

describe("PageContext schema", () => {
  const validContext = {
    url: "https://example.test/article",
    pageTitle: "Example",
    text: "A useful paragraph.",
    selectedText: null,
    nearbyHeading: null,
    contextKind: "text" as const,
    numericCandidates: []
  }

  it("accepts a valid pure-data context", () => {
    expect(PageContextSchema.safeParse(validContext).success).toBe(true)
  })

  it("rejects text that exceeds the privacy limit", () => {
    expect(PageContextSchema.safeParse({ ...validContext, text: "x".repeat(1501) }).success).toBe(false)
  })

  it("rejects too many candidates, invalid kinds, and non-finite values", () => {
    expect(
      PageContextSchema.safeParse({
        ...validContext,
        numericCandidates: Array.from({ length: 21 }, () => ({ label: "", rawValue: "1", value: 1 }))
      }).success
    ).toBe(false)
    expect(PageContextSchema.safeParse({ ...validContext, contextKind: "chart" }).success).toBe(false)
    expect(
      PageContextSchema.safeParse({
        ...validContext,
        numericCandidates: [{ label: "", rawValue: "1", value: Number.POSITIVE_INFINITY }]
      }).success
    ).toBe(false)
  })
})
