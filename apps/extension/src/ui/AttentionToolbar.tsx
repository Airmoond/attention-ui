import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { AttentionCandidate } from "../attention/attention-engine"
import type { LocalTool } from "../policy/local-policy"
import { calculateToolbarPosition, type ToolbarPosition } from "../position/position-manager"
import { Icon } from "./Icon"

export type AttentionToolbarProps = {
  candidate: AttentionCandidate
  tools: LocalTool[]
  onClose: () => void
  onToolSelect: (tool: LocalTool) => void
}

export const AttentionToolbar = forwardRef<HTMLDivElement, AttentionToolbarProps>(
  ({ candidate, tools, onClose, onToolSelect }, forwardedRef): React.JSX.Element => {
    const toolbarRef = useRef<HTMLDivElement | null>(null)
    const [position, setPosition] = useState<ToolbarPosition | null>(null)
    const setToolbarRef = useCallback(
      (element: HTMLDivElement | null): void => {
        toolbarRef.current = element
        if (typeof forwardedRef === "function") {
          forwardedRef(element)
        } else if (forwardedRef) {
          forwardedRef.current = element
        }
      },
      [forwardedRef]
    )

    const recalculatePosition = useCallback((): void => {
      const toolbar = toolbarRef.current
      if (!toolbar) {
        return
      }

      const toolbarRect = toolbar.getBoundingClientRect()
      if (toolbarRect.width <= 0 || toolbarRect.height <= 0) {
        return
      }
      const targetRect = candidate.element.isConnected
        ? candidate.element.getBoundingClientRect()
        : candidate.rect
      const nextPosition = calculateToolbarPosition({
        targetRect,
        toolbarWidth: toolbarRect.width,
        toolbarHeight: toolbarRect.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        pointerX: candidate.pointerX,
        pointerY: candidate.pointerY
      })
      setPosition((current) =>
        current?.left === nextPosition.left &&
        current.top === nextPosition.top &&
        current.placement === nextPosition.placement
          ? current
          : nextPosition
      )
    }, [candidate])

    useLayoutEffect(() => {
      recalculatePosition()
    }, [recalculatePosition, tools])

    useEffect(() => {
      const toolbar = toolbarRef.current
      const resizeObserver = toolbar ? new ResizeObserver(recalculatePosition) : null
      if (toolbar) {
        resizeObserver?.observe(toolbar)
      }
      window.addEventListener("resize", recalculatePosition)
      return () => {
        resizeObserver?.disconnect()
        window.removeEventListener("resize", recalculatePosition)
      }
    }, [recalculatePosition])

    return (
      <div
        ref={setToolbarRef}
        className="attention-ui-toolbar"
        role="toolbar"
        aria-label="AttentionUI工具条"
        data-placement={position?.placement}
        style={{
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position ? "visible" : "hidden"
        }}
      >
        {tools.map((tool) => (
          <button
            key={tool.id}
            className="attention-ui-tool-button"
            type="button"
            aria-label={tool.label}
            title={tool.label}
            onClick={() => onToolSelect(tool)}
          >
            <Icon name={tool.id} />{tool.label}
          </button>
        ))}
        <span className="attention-ui-separator" aria-hidden="true" />
        <button
          className="attention-ui-close-button"
          type="button"
          aria-label="关闭AttentionUI工具条"
          title="关闭"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
    )
  }
)

AttentionToolbar.displayName = "AttentionToolbar"
