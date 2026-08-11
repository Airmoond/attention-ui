import { describe, expect, it } from "vitest"
import { getTrayServiceMenuState, getWindowCloseDecision } from "./tray-logic"

describe("tray lifecycle decisions", () => {
  it("hides a normal close and allows a real application quit", () => {
    expect(getWindowCloseDecision(false)).toBe("hide")
    expect(getWindowCloseDecision(true)).toBe("close")
  })

  it("enables only the valid service action", () => {
    expect(getTrayServiceMenuState(true)).toEqual({
      startEnabled: false,
      stopEnabled: true
    })
    expect(getTrayServiceMenuState(false)).toEqual({
      startEnabled: true,
      stopEnabled: false
    })
  })
})
