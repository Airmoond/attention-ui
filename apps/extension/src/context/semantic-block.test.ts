import { describe, expect, it } from "vitest"
import {
  hasAcceptableBlockSize,
  hasMeaningfulText,
  normalizeVisibleText,
  SEMANTIC_BLOCK_LIMITS
} from "./semantic-block"

describe("semantic block helpers", () => {
  it("normalizes visible text whitespace", () => {
    expect(normalizeVisibleText("  Alpha\n\t Beta   Gamma ")).toBe("Alpha Beta Gamma")
  })

  it("rejects short, symbol-only, and single-number content", () => {
    expect(hasMeaningfulText("Short content")).toBe(false)
    expect(hasMeaningfulText("!!! --- ***")).toBe(false)
    expect(hasMeaningfulText("2024")).toBe(false)
  })

  it("accepts a substantial paragraph", () => {
    expect(hasMeaningfulText("This is a sufficiently long paragraph with meaningful readable content.")).toBe(true)
  })

  it("rejects tiny and viewport-covering containers", () => {
    const viewport = { innerWidth: 1000, innerHeight: 800 }
    expect(hasAcceptableBlockSize({ width: 39, height: 100, top: 0, left: 0, right: 39, bottom: 100 }, viewport)).toBe(false)
    expect(hasAcceptableBlockSize({ width: 900, height: 800, top: 0, left: 0, right: 900, bottom: 800 }, viewport)).toBe(false)
  })

  it("accepts a reasonably sized content block", () => {
    const viewport = { innerWidth: 1000, innerHeight: 800 }
    expect(hasAcceptableBlockSize({ width: 600, height: 240, top: 0, left: 0, right: 600, bottom: 240 }, viewport)).toBe(true)
    expect(SEMANTIC_BLOCK_LIMITS.minimumTextLength).toBe(20)
  })
})
