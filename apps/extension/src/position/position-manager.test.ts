import { describe, expect, it } from "vitest"
import {
  calculateToolbarPosition,
  POINTER_SAFE_RADIUS_PX,
  VIEWPORT_MARGIN_PX,
  type PositionInput
} from "./position-manager"

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  }) as DOMRect

const createInput = (targetRect: DOMRect, overrides: Partial<PositionInput> = {}): PositionInput => ({
  targetRect,
  toolbarWidth: 180,
  toolbarHeight: 44,
  viewportWidth: 1000,
  viewportHeight: 800,
  pointerX: targetRect.left + targetRect.width / 2,
  pointerY: targetRect.top + targetRect.height / 2,
  ...overrides
})

describe("toolbar position manager", () => {
  it("prefers the right side for a central target", () => {
    expect(calculateToolbarPosition(createInput(rect(300, 300, 240, 100))).placement).toBe("right")
  })

  it("uses the left side when the right side does not fit", () => {
    expect(calculateToolbarPosition(createInput(rect(820, 300, 150, 100))).placement).toBe("left")
  })

  it("uses the bottom when neither horizontal side fits", () => {
    const input = createInput(rect(120, 260, 160, 80), {
      toolbarWidth: 300,
      viewportWidth: 400
    })
    expect(calculateToolbarPosition(input).placement).toBe("bottom")
  })

  it("uses the top when only the upper placement fits", () => {
    const input = createInput(rect(120, 680, 160, 60), {
      toolbarWidth: 300,
      toolbarHeight: 80,
      viewportWidth: 400,
      viewportHeight: 760
    })
    expect(calculateToolbarPosition(input).placement).toBe("top")
  })

  it("clamps positions at the top and bottom viewport edges", () => {
    const topPosition = calculateToolbarPosition(createInput(rect(300, -20, 240, 40)))
    const bottomInput = createInput(rect(300, 760, 240, 60))
    const bottomPosition = calculateToolbarPosition(bottomInput)

    expect(topPosition.top).toBeGreaterThanOrEqual(VIEWPORT_MARGIN_PX)
    expect(bottomPosition.top + bottomInput.toolbarHeight).toBeLessThanOrEqual(
      bottomInput.viewportHeight - VIEWPORT_MARGIN_PX
    )
  })

  it("tries another placement when the pointer overlaps the preferred position", () => {
    const target = rect(300, 300, 200, 80)
    const input = createInput(target, {
      pointerX: target.right + 10 + POINTER_SAFE_RADIUS_PX,
      pointerY: target.top + target.height / 2
    })

    expect(calculateToolbarPosition(input).placement).toBe("left")
  })

  it("pins an oversized toolbar to the safe viewport origin", () => {
    const position = calculateToolbarPosition(
      createInput(rect(20, 20, 40, 40), {
        toolbarWidth: 1200,
        toolbarHeight: 900
      })
    )

    expect(position.left).toBe(VIEWPORT_MARGIN_PX)
    expect(position.top).toBe(VIEWPORT_MARGIN_PX)
  })
})
