import { describe, expect, it } from "vitest"
import { createPointerSnapshot } from "./pointer-tracker"

describe("pointer tracker math", () => {
  it("starts at zero speed", () => {
    expect(createPointerSnapshot(null, 10, 20, 100)).toEqual({
      x: 10,
      y: 20,
      timestamp: 100,
      speedPxPerMs: 0
    })
  })

  it("calculates Euclidean pointer speed", () => {
    const previous = createPointerSnapshot(null, 0, 0, 100)
    expect(createPointerSnapshot(previous, 30, 40, 200).speedPxPerMs).toBe(0.5)
  })

  it("avoids division by zero", () => {
    const previous = createPointerSnapshot(null, 0, 0, 100)
    expect(createPointerSnapshot(previous, 30, 40, 100).speedPxPerMs).toBe(0)
  })
})
