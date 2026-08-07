import { describe, expect, it } from "vitest"
import { ATTENTION_COOLDOWN_MS, isCoolingDown } from "./attention-engine"

describe("attention cooldown", () => {
  it("blocks repeated candidates during the cooldown", () => {
    expect(isCoolingDown(1_000, 1_000 + ATTENTION_COOLDOWN_MS - 1)).toBe(true)
  })

  it("allows a candidate when the cooldown expires", () => {
    expect(isCoolingDown(1_000, 1_000 + ATTENTION_COOLDOWN_MS)).toBe(false)
  })

  it("allows a previously unseen element", () => {
    expect(isCoolingDown(undefined, 1_000)).toBe(false)
  })
})
