export type ToolbarPlacement = "right" | "left" | "bottom" | "top"

export type PositionInput = {
  targetRect: DOMRect
  toolbarWidth: number
  toolbarHeight: number
  viewportWidth: number
  viewportHeight: number
  pointerX: number
  pointerY: number
}

export type ToolbarPosition = {
  top: number
  left: number
  placement: ToolbarPlacement
}

export const TOOLBAR_GAP_PX = 10
export const VIEWPORT_MARGIN_PX = 8
export const POINTER_SAFE_RADIUS_PX = 16

type PositionCandidate = ToolbarPosition

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum))

const fitsViewport = (
  candidate: PositionCandidate,
  input: PositionInput
): boolean =>
  candidate.left >= VIEWPORT_MARGIN_PX &&
  candidate.top >= VIEWPORT_MARGIN_PX &&
  candidate.left + input.toolbarWidth <= input.viewportWidth - VIEWPORT_MARGIN_PX &&
  candidate.top + input.toolbarHeight <= input.viewportHeight - VIEWPORT_MARGIN_PX

const avoidsPointer = (candidate: PositionCandidate, input: PositionInput): boolean => {
  const pointerLeft = input.pointerX - POINTER_SAFE_RADIUS_PX
  const pointerRight = input.pointerX + POINTER_SAFE_RADIUS_PX
  const pointerTop = input.pointerY - POINTER_SAFE_RADIUS_PX
  const pointerBottom = input.pointerY + POINTER_SAFE_RADIUS_PX

  return (
    candidate.left + input.toolbarWidth < pointerLeft ||
    candidate.left > pointerRight ||
    candidate.top + input.toolbarHeight < pointerTop ||
    candidate.top > pointerBottom
  )
}

const createCandidates = (
  input: PositionInput
): [PositionCandidate, PositionCandidate, PositionCandidate, PositionCandidate] => {
  const horizontalTop = input.targetRect.top + (input.targetRect.height - input.toolbarHeight) / 2
  const verticalLeft = input.targetRect.left + (input.targetRect.width - input.toolbarWidth) / 2

  return [
    {
      placement: "right",
      left: input.targetRect.right + TOOLBAR_GAP_PX,
      top: horizontalTop
    },
    {
      placement: "left",
      left: input.targetRect.left - TOOLBAR_GAP_PX - input.toolbarWidth,
      top: horizontalTop
    },
    {
      placement: "bottom",
      left: verticalLeft,
      top: input.targetRect.bottom + TOOLBAR_GAP_PX
    },
    {
      placement: "top",
      left: verticalLeft,
      top: input.targetRect.top - TOOLBAR_GAP_PX - input.toolbarHeight
    }
  ]
}

export const calculateToolbarPosition = (input: PositionInput): ToolbarPosition => {
  const candidates = createCandidates(input)
  const preferred =
    candidates.find((candidate) => fitsViewport(candidate, input) && avoidsPointer(candidate, input)) ??
    candidates.find((candidate) => fitsViewport(candidate, input)) ??
    candidates.find((candidate) => avoidsPointer(candidate, input)) ??
    candidates[0]

  return {
    placement: preferred.placement,
    left: clamp(
      preferred.left,
      VIEWPORT_MARGIN_PX,
      input.viewportWidth - VIEWPORT_MARGIN_PX - input.toolbarWidth
    ),
    top: clamp(
      preferred.top,
      VIEWPORT_MARGIN_PX,
      input.viewportHeight - VIEWPORT_MARGIN_PX - input.toolbarHeight
    )
  }
}
